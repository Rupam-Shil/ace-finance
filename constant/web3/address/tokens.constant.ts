import { Web3Address } from '@/types/web3/web3.types';

export type StandardToken = {
	address: Web3Address;
	name: string;
	symbol: string;
	decimals: number;
	logo: string;
	tokenId: bigint;
};

const TOKEN_IDS: bigint[] = [BigInt(1), BigInt(2), BigInt(3), BigInt(4)];

export const TOKENS: StandardToken[] = [
	{
		address: '0x4200000000000000000000000000000000000006',
		name: 'WETH',
		symbol: 'WETH',
		decimals: 18,
		logo: 'https://img.cryptorank.io/coins/weth1701090834118.png',
		tokenId: TOKEN_IDS[0],
	},
	{
		address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		name: 'USDC',
		symbol: 'USDC',
		decimals: 6,
		logo: 'https://img.cryptorank.io/coins/usd%20coin1634317395959.png',
		tokenId: TOKEN_IDS[1],
	},
	{
		address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
		name: 'DAI',
		symbol: 'DAI',
		decimals: 18,
		logo: 'https://img.cryptorank.io/coins/multi-collateral-dai1574400689822.png',
		tokenId: TOKEN_IDS[2],
	},
	{
		address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
		name: 'USDT',
		symbol: 'USDT',
		decimals: 6,
		logo: 'https://img.cryptorank.io/coins/tether1645007690922.png',
		tokenId: TOKEN_IDS[3],
	},
];
