import { Web3Address } from '@/types/web3/web3.types';

export type Pool = {
	name: string;
	address: string;
};

export const POOL_ADDRESSES: Web3Address[] = [
	'0x319cb8bECEb0bC1eb961EeE1Eb95193c53149e21',
	'0x698036f984fcf2225895748f4d80e25749437d24',
	'0xa05d5c0De9e033954B532A40E7b43A23B92600f9',
];

export const POOLS: Pool[] = [
	{
		name: 'High Growth Pool',
		address: POOL_ADDRESSES[0],
	},
	{
		name: 'Balanced Growth Pool',
		address: POOL_ADDRESSES[1],
	},
	{
		name: 'Stable Growth Pool',
		address: POOL_ADDRESSES[2],
	},
];
