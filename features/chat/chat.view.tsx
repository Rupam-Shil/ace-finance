/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, {
	useEffect,
	useMemo,
	useCallback,
	useRef,
	useState,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { toast } from 'sonner';
import { ethers } from 'ethers';
import ChatMessages from './components/ChatMessages';
import ChatInput from './components/ChatInput';
import styles from './chat.module.scss';
import { ENDPOINTS } from '@/constant/api/endpoints.constant';
import { useWeb3User } from '@/context/web3-user.context';
import { useChatStore } from '@/store/useChatStore';

// Define transaction data interface first so it can be used in the global declaration
interface TransactionData {
	to: string;
	data: string;
	value: string;
	tokenAddress?: string;
	tokenDecimals?: number;
	tokenSymbol?: string;
	from?: string;
	amount?: string; // Amount for approval
}

declare global {
	interface Window {
		ethereum?: any;
		latestTransaction?: TransactionData;
		executeTransaction?: () => TransactionData;
		sendTransactionToMetaMask?: (
			txData: TransactionData
		) => Promise<string>;
		approveTokenAndSendTransaction?: (
			txData: TransactionData
		) => Promise<string>;
	}
}

// ERC20 ABI for token approval
const ERC20_ABI = [
	'function approve(address spender, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
];

const ChatView: React.FC = () => {
	const { address } = useWeb3User();
	const { messages: storedMessages, setMessages: setStoredMessages } =
		useChatStore();

	// State to track approval status
	const [isApproving, setIsApproving] = useState(false);

	const initialMessages = useMemo(() => {
		// If there are stored messages, use those
		if (storedMessages.length > 0) {
			return storedMessages;
		}

		return [];
	}, [storedMessages]);

	const { messages, input, handleSubmit, status, error, append } = useChat({
		api: ENDPOINTS.CHAT.POST,
		body: { walletAddress: address || '' },
		initialMessages,
	});

	const isLoading = useMemo(
		() => ['streaming', 'submitted'].includes(status),
		[status]
	);

	// Sync messages with the store whenever they change
	useEffect(() => {
		if (messages.length > 0) {
			setStoredMessages(messages);
		}
	}, [messages, setStoredMessages]);

	// Show toast notification when error occurs
	useEffect(() => {
		if (error) {
			toast.error(
				typeof error === 'string' ? error : (
					error.message || 'An error occurred'
				)
			);
		}
	}, [error]);

	// Define types for the message structure
	interface ToolResult {
		success: boolean;
		transaction?: TransactionData;
	}

	interface ToolInvocation {
		toolName: string;
		toolCallId: string;
		args: Record<string, unknown>;
		result?: ToolResult;
		state: string;
		step: number;
	}

	interface MessagePart {
		type: string;
		[key: string]: unknown;
	}

	interface ChatMessage {
		id: string;
		role: string;
		content: string;
		toolInvocations?: ToolInvocation[];
		parts?: Array<MessagePart>;
	}

	// Keep track of processed message IDs to prevent duplicate processing
	const processedMessageIds = useRef<Set<string>>(new Set());

	// Extract transaction from message and make it available globally
	const processTransactionFromMessage = useCallback(
		(message: ChatMessage) => {
			// This function sends a transaction to MetaMask using the already connected address
			const sendToMetaMask = (
				transactionData: TransactionData
			): Promise<string> => {
				return new Promise((resolve, reject) => {
					// Check if MetaMask is available
					if (!window.ethereum) {
						reject(
							new Error(
								'MetaMask is not installed. Please install MetaMask to continue.'
							)
						);
						return;
					}

					// Check if we have an address
					if (!address) {
						reject(
							new Error(
								'No wallet address found. Please connect your wallet.'
							)
						);
						return;
					}

					// Prepare transaction parameters using the already connected address
					const mainTxParams = {
						from: address,
						to: transactionData.to,
						data: transactionData.data,
						value:
							transactionData.value === '0' ?
								'0x0'
							:	transactionData.value,
					};

					// Send transaction directly
					window.ethereum
						.request({
							method: 'eth_sendTransaction',
							params: [mainTxParams],
						})
						.then((txHash: unknown) => {
							resolve(txHash as string);
						})
						.catch((error: Error) => {
							console.error('Error sending transaction:', error);
							reject(error);
						});
				});
			};

			// Extract transaction data from AI response
			const extractTransaction = (msg: ChatMessage) => {
				try {
					// Check if the message has toolInvocations array
					if (
						msg.toolInvocations &&
						Array.isArray(msg.toolInvocations)
					) {
						// Look for prepareInvestmentTransaction tool call
						const investmentTool = msg.toolInvocations.find(
							(tool) =>
								tool.toolName ===
									'prepareInvestmentTransaction' &&
								tool.result
						);

						if (investmentTool && investmentTool.result) {
							const result = investmentTool.result;
							if (result.success && result.transaction) {
								return result.transaction;
							}
						}
					}

					return null;
				} catch (err) {
					console.error('Error extracting transaction:', err);
					return null;
				}
			};

			// Extract transaction if present
			const transaction = extractTransaction(message);

			if (transaction) {
				// Create a transaction object with all necessary data
				const txData: TransactionData = {
					to: transaction.to,
					data: transaction.data,
					value: transaction.value,
					tokenAddress: transaction.tokenAddress,
					tokenSymbol: transaction.tokenSymbol,
					tokenDecimals: transaction.tokenDecimals,
					from: address || '',
				};

				// Make transaction data available globally
				window.latestTransaction = txData;

				// Create global functions to execute this transaction
				window.executeTransaction = () => {
					console.log('Transaction ready to execute:', txData);
					return txData;
				};

				// Add the sendTransactionToMetaMask function to window
				window.sendTransactionToMetaMask = (
					transData: TransactionData
				) => {
					return sendToMetaMask(transData);
				};

				// Add a function to approve tokens before sending the transaction
				window.approveTokenAndSendTransaction = async (
					transData: TransactionData
				) => {
					try {
						// Check if token address exists
						if (!transData.tokenAddress) {
							console.log(
								'No token address found, proceeding with transaction directly'
							);
							return sendToMetaMask(transData);
						}

						setIsApproving(true);
						toast.info('Checking token approval...');

						// Create a provider
						const provider = new ethers.BrowserProvider(
							window.ethereum
						);
						const signer = await provider.getSigner();

						// Create token contract instance
						const tokenContract = new ethers.Contract(
							transData.tokenAddress,
							ERC20_ABI,
							signer
						);

						// Get current allowance
						const currentAllowance = await tokenContract.allowance(
							address,
							transData.to
						);
						console.log(
							'Current allowance:',
							currentAllowance.toString()
						);

						// Calculate required amount for approval (use MAX_UINT256 for unlimited approval)
						const MAX_UINT256 = ethers.MaxUint256;

						// Check if we need to approve
						if (currentAllowance < BigInt(1)) {
							// Send approval transaction
							const approveTx = await tokenContract.approve(
								transData.to,
								MAX_UINT256
							);
							toast.info(
								`Approval transaction sent: ${approveTx.hash.substring(0, 10)}...`
							);

							// Wait for approval to be mined
							const approveReceipt = await approveTx.wait();
							console.log(
								'Approval transaction confirmed:',
								approveReceipt
							);
							toast.success(
								`${transData.tokenSymbol || 'Token'} approved successfully!`
							);
						} else {
							console.log('Token already approved');
							toast.info(
								'Token already approved, proceeding with transaction...'
							);
						}

						setIsApproving(false);

						// Now send the actual transaction
						return sendToMetaMask(transData);
					} catch (error: any) {
						setIsApproving(false);
						console.error('Error during approval process:', error);
						toast.error(
							`Approval failed: ${error.message || 'Unknown error'}`
						);
						throw error;
					}
				};

				// Just log the transaction data to console for debugging
				console.log(
					'Found transaction data, preparing to send to MetaMask:',
					txData
				);

				return true;
			}

			return false;
		},
		[address]
	);

	// Watch for new messages that might contain transactions
	useEffect(() => {
		if (messages.length > 0) {
			const lastMessage = messages[messages.length - 1] as ChatMessage;

			// Only process assistant messages that haven't been processed yet
			if (
				lastMessage.role === 'assistant' &&
				lastMessage.id &&
				!processedMessageIds.current.has(lastMessage.id)
			) {
				// Mark this message as processed
				processedMessageIds.current.add(lastMessage.id);

				// Process the transaction and automatically send to MetaMask if transaction is found
				const hasTransaction =
					processTransactionFromMessage(lastMessage);

				// If transaction was found, automatically approve tokens and send transaction
				if (
					hasTransaction &&
					window.latestTransaction &&
					window.approveTokenAndSendTransaction
				) {
					window
						.approveTokenAndSendTransaction(
							window.latestTransaction
						)
						.then((hash) => {
							toast.success('Transaction sent!', {
								description: `Transaction hash: ${hash.substring(0, 10)}...`,
							});
						})
						.catch((err) => {
							toast.error('Transaction failed', {
								description: err.message,
							});
						});
				}
			}
		}
	}, [messages, processTransactionFromMessage]);

	return (
		<div className={styles.chatContainer}>
			{isApproving && (
				<div className={styles.approvalOverlay}>
					<div className={styles.approvalMessage}>
						Approving tokens... Please confirm in your wallet.
					</div>
				</div>
			)}
			<div className={styles.chatContent}>
				<ChatMessages
					messages={messages}
					isLoading={isLoading}
				/>
			</div>

			<form
				className={styles.chatForm}
				onSubmit={(e) => {
					e.preventDefault();
					if (input.trim()) handleSubmit();
				}}>
				<ChatInput
					onSend={(msg) => append({ role: 'user', content: msg })}
					loading={isLoading}
				/>
			</form>
		</div>
	);
};

export default ChatView;