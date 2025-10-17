export const csdnAbi = [
  {
    type: 'function',
    name: 'stateOf',
    stateMutability: 'view',
    inputs: [{ name: 'noteId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'originate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'docHash', type: 'bytes32' },
      { name: 'principal', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'issue',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'noteId', type: 'uint256' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'insure',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'subscribe',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'lp', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'markDistribution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'lp', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'pause',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    type: 'function',
    name: 'unpause',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    type: 'event',
    name: 'Originated',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'docHash', type: 'bytes32', indexed: true },
      { name: 'principal', type: 'uint256', indexed: false },
      { name: 'originator', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'Issued',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'issuer', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'Insured',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'insuredAmount', type: 'uint256', indexed: false },
      { name: 'underwriter', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'lp', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'operator', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'DistributionMarked',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'lp', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'executor', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'Redeemed',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'lp', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'executor', type: 'address', indexed: true }
    ]
  }
] as const;

export const getCsdnAddress = () => process.env.NEXT_PUBLIC_CSDN_ADDRESS ?? '0x0000000000000000000000000000000000000000';
