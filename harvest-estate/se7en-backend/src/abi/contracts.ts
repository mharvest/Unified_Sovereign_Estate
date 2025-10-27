export const AccessRolesABI = [
  {
    type: 'function',
    name: 'grantRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' }
    ],
    outputs: []
  }
] as const;

export const EklesiaAttestorABI = [
  {
    type: 'event',
    name: 'Attested',
    inputs: [
      { name: 'attestationId', type: 'bytes32', indexed: true },
      { name: 'subjectId', type: 'bytes32', indexed: true },
      { name: 'payloadHash', type: 'bytes32' },
      { name: 'jurisdiction', type: 'string' },
      { name: 'clause', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'attestor', type: 'address', indexed: true }
    ]
  },
  {
    type: 'function',
    name: 'recordAttestation',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'subjectId', type: 'bytes32' },
      { name: 'payloadHash', type: 'bytes32' },
      { name: 'clause', type: 'bytes32' }
    ],
    outputs: [{ name: 'attestationId', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'get',
    stateMutability: 'view',
    inputs: [{ name: 'attestationId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'subjectId', type: 'bytes32' },
          { name: 'payloadHash', type: 'bytes32' },
          { name: 'clause', type: 'bytes32' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'attestor', type: 'address' }
        ]
      }
    ]
  }
] as const;

export const AffidavitRegistryABI = [
  {
    type: 'event',
    name: 'AffidavitCreated',
    inputs: [
      { name: 'affidavitId', type: 'bytes32', indexed: true },
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'documentHash', type: 'bytes32' },
      { name: 'witness', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'createAffidavit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'meta', type: 'bytes' }
    ],
    outputs: [{ name: 'affidavitId', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'latestAffidavit',
    stateMutability: 'view',
    inputs: [{ name: 'assetId', type: 'bytes32' }],
    outputs: [{ type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'getAffidavit',
    stateMutability: 'view',
    inputs: [{ name: 'affidavitId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'assetId', type: 'bytes32' },
          { name: 'documentHash', type: 'bytes32' },
          { name: 'witness', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'metadata', type: 'bytes' }
        ]
      }
    ]
  }
] as const;

export const SafeVaultABI = [
  {
    type: 'event',
    name: 'CustodyUpdated',
    inputs: [
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'custody', type: 'bool' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'actor', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'DocumentStored',
    inputs: [
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'docHash', type: 'bytes32', indexed: true },
      { name: 'actor', type: 'address', indexed: true }
    ]
  },
  {
    type: 'function',
    name: 'setCustody',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'value', type: 'bool' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'setDoc',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'docHash', type: 'bytes32' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'hasCustody',
    stateMutability: 'view',
    inputs: [{ name: 'assetId', type: 'bytes32' }],
    outputs: [{ type: 'bool' }]
  },
  {
    type: 'function',
    name: 'getDocHashes',
    stateMutability: 'view',
    inputs: [{ name: 'assetId', type: 'bytes32' }],
    outputs: [{ type: 'bytes32[]' }]
  }
] as const;

export const VaultQuantABI = [
  {
    type: 'event',
    name: 'AssetNavSet',
    inputs: [
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'nav', type: 'uint256' },
      { name: 'actor', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'InstrumentIssued',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'instrumentType', type: 'uint8' },
      { name: 'par', type: 'uint256' },
      { name: 'nav', type: 'uint256' },
      { name: 'affidavitId', type: 'bytes32' }
    ]
  },
  {
    type: 'event',
    name: 'InstrumentRedeemed',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256' },
      { name: 'remainingNav', type: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'NoteNavUpdated',
    inputs: [
      { name: 'noteId', type: 'uint256', indexed: true },
      { name: 'nav', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'setAssetNAV',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'navWei', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'issueCSDN',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'par', type: 'uint256' }
    ],
    outputs: [{ name: 'noteId', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'issueSDN',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'par', type: 'uint256' }
    ],
    outputs: [{ name: 'noteId', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'getNote',
    stateMutability: 'view',
    inputs: [{ name: 'noteId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'assetId', type: 'bytes32' },
          { name: 'instrumentType', type: 'uint8' },
          { name: 'par', type: 'uint256' },
          { name: 'nav', type: 'uint256' },
          { name: 'affidavitId', type: 'bytes32' },
          { name: 'attestationId', type: 'bytes32' },
          { name: 'active', type: 'bool' }
        ]
      }
    ]
  },
  {
    type: 'function',
    name: 'getAggregateNAV',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'navCsdn', type: 'uint256' },
      { name: 'navSdn', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'settleRedemption',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'updateNoteAttestation',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'attestationId', type: 'bytes32' }
    ],
    outputs: []
  }
] as const;

export const MatriarchInsuranceABI = [
  {
    type: 'event',
    name: 'BandsDisclosureAnchored',
    inputs: [
      { name: 'disclosureHash', type: 'bytes32', indexed: true },
      { name: 'timestamp', type: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'CoverageBound',
    inputs: [
      { name: 'binderId', type: 'bytes32', indexed: true },
      { name: 'assetId', type: 'bytes32', indexed: true },
      { name: 'classCode', type: 'uint8' },
      { name: 'factorBps', type: 'uint256' },
      { name: 'underwriter', type: 'address', indexed: true }
    ]
  },
  {
    type: 'function',
    name: 'bindCoverage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'classCode', type: 'uint16' },
      { name: 'factorBps', type: 'uint256' },
      { name: 'disclosureHash', type: 'bytes32' }
    ],
    outputs: [{ name: 'binderId', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'getPolicyFloorBps',
    stateMutability: 'pure',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
] as const;

export const HRVSTABI = [
  {
    type: 'event',
    name: 'MintByNAV',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
      { name: 'navCsdn', type: 'uint256' },
      { name: 'navSdn', type: 'uint256' },
      { name: 'floorBps', type: 'uint256' }
    ]
  },
  {
    type: 'function',
    name: 'mintByNAV',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'navCsdn', type: 'uint256' },
      { name: 'navSdn', type: 'uint256' },
      { name: 'floorBps', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    outputs: [{ name: 'amount', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'burnFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'policyFloorBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
] as const;

export const KiiantuCyclesABI = [
  {
    type: 'event',
    name: 'CycleRun',
    inputs: [
      { name: 'cycleId', type: 'bytes32', indexed: true },
      { name: 'noteId', type: 'uint256', indexed: true }
    ]
  },
  {
    type: 'function',
    name: 'runCycle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'noteId', type: 'uint256' },
      { name: 'days', type: 'uint16' },
      { name: 'rateBps', type: 'uint16' }
    ],
    outputs: [{ name: 'cycleId', type: 'bytes32' }]
  }
] as const;

export const AnimaABI = [
  {
    type: 'function',
    name: 'ok',
    stateMutability: 'view',
    inputs: [
      { name: 'assetId', type: 'bytes32' },
      { name: 'action', type: 'bytes32' }
    ],
    outputs: [{ type: 'bool' }]
  }
] as const;
