export const routerAbi = [
  {
    type: 'function',
    name: 'subscribeWithKyc',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'lp', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'leaf', type: 'bytes32' },
      { name: 'proof', type: 'bytes32[]' }
    ],
    outputs: []
  },
  {
    type: 'event',
    name: 'KYCSubscribed',
    inputs: [
      { name: 'lp', type: 'address', indexed: true },
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'leaf', type: 'bytes32', indexed: false },
      { name: 'escrow', type: 'address', indexed: true }
    ]
  }
] as const;

export const getRouterAddress = () => process.env.NEXT_PUBLIC_ROUTER_ADDRESS ?? '0x0000000000000000000000000000000000000000';
