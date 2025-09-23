/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/prefix_system.json`.
 */
export type PrefixSystem = {
  "address": "otac5xyDhtoUWRXi36R9QN8Q9rW89QNJfUQDrZyiidh",
  "metadata": {
    "name": "prefixSystem",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Action Codes Protocol Prefix System"
  },
  "instructions": [
    {
      "name": "addVerifier",
      "discriminator": [
        165,
        72,
        135,
        225,
        67,
        181,
        255,
        135
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verifiers",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114,
                  115
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "verifier",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "approvePrefix",
      "discriminator": [
        155,
        130,
        58,
        144,
        235,
        206,
        247,
        80
      ],
      "accounts": [
        {
          "name": "verifier",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verifiers",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        },
        {
          "name": "refHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "deactivatePrefix",
      "discriminator": [
        204,
        8,
        250,
        229,
        95,
        93,
        67,
        107
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Payer who funds the initial accounts (must be a signer)"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "feeRegistry",
          "docs": [
            "Fee registry PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verifiers",
          "docs": [
            "Verifiers list PDA"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "feeRegistry"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "adminPubkey",
          "type": "pubkey"
        },
        {
          "name": "initialFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "reactivatePrefix",
      "discriminator": [
        7,
        33,
        55,
        144,
        195,
        34,
        242,
        239
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        }
      ]
    },
    {
      "name": "recoverPrefixOwnerWithFee",
      "discriminator": [
        161,
        252,
        183,
        129,
        28,
        153,
        208,
        98
      ],
      "accounts": [
        {
          "name": "newOwner",
          "docs": [
            "New owner who will pay the recovery fee"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "admin",
          "docs": [
            "Admin/multisig who authorizes the recovery"
          ],
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "feeRegistry"
              }
            ]
          }
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        },
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "refundPrefixFee",
      "discriminator": [
        235,
        130,
        86,
        154,
        26,
        65,
        65,
        249
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "feeRegistry"
              }
            ]
          }
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        }
      ]
    },
    {
      "name": "rejectPrefix",
      "discriminator": [
        27,
        106,
        152,
        79,
        143,
        142,
        116,
        46
      ],
      "accounts": [
        {
          "name": "verifier",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verifiers",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "removeVerifier",
      "discriminator": [
        179,
        9,
        132,
        183,
        233,
        23,
        172,
        111
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "verifiers",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114,
                  115
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "verifier",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setPause",
      "discriminator": [
        63,
        32,
        154,
        2,
        56,
        103,
        79,
        45
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "pause",
          "type": "bool"
        }
      ]
    },
    {
      "name": "submitPrefixWithFee",
      "discriminator": [
        36,
        227,
        120,
        228,
        189,
        42,
        195,
        166
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "Owner must be signer to pay for account creation"
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "feeRegistry"
              }
            ]
          }
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        },
        {
          "name": "metadataUri",
          "type": "string"
        },
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "authorityKeys",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "updateFee",
      "discriminator": [
        232,
        253,
        195,
        247,
        148,
        212,
        73,
        222
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newFee",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updatePrefixAuthority",
      "discriminator": [
        81,
        34,
        201,
        205,
        160,
        31,
        146,
        85
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        },
        {
          "name": "authorityKeys",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "updatePrefixMetadata",
      "discriminator": [
        208,
        18,
        7,
        217,
        10,
        21,
        141,
        252
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true
        },
        {
          "name": "prefixAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  101,
                  102,
                  105,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "prefix"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "prefix",
          "type": "string"
        },
        {
          "name": "newMetadataUri",
          "type": "string"
        },
        {
          "name": "newMetadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "withdrawTreasury",
      "discriminator": [
        40,
        63,
        122,
        158,
        144,
        216,
        83,
        96
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "feeRegistry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "feeRegistry"
              }
            ]
          }
        },
        {
          "name": "to",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "to",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "feeRegistry",
      "discriminator": [
        201,
        150,
        48,
        215,
        144,
        177,
        181,
        213
      ]
    },
    {
      "name": "prefixAccount",
      "discriminator": [
        57,
        137,
        99,
        5,
        57,
        10,
        236,
        73
      ]
    },
    {
      "name": "verifiersList",
      "discriminator": [
        75,
        207,
        103,
        108,
        203,
        15,
        15,
        249
      ]
    }
  ],
  "events": [
    {
      "name": "feeUpdated",
      "discriminator": [
        228,
        75,
        43,
        103,
        9,
        196,
        182,
        4
      ]
    },
    {
      "name": "prefixActivated",
      "discriminator": [
        117,
        212,
        125,
        79,
        252,
        18,
        79,
        134
      ]
    },
    {
      "name": "prefixApproved",
      "discriminator": [
        61,
        152,
        118,
        94,
        46,
        118,
        252,
        190
      ]
    },
    {
      "name": "prefixAuthorityUpdated",
      "discriminator": [
        25,
        94,
        192,
        163,
        229,
        29,
        255,
        39
      ]
    },
    {
      "name": "prefixDeactivated",
      "discriminator": [
        243,
        73,
        179,
        248,
        189,
        255,
        67,
        57
      ]
    },
    {
      "name": "prefixMetadataUpdated",
      "discriminator": [
        187,
        126,
        200,
        26,
        142,
        203,
        246,
        0
      ]
    },
    {
      "name": "prefixOwnerRecovered",
      "discriminator": [
        159,
        47,
        147,
        172,
        233,
        220,
        89,
        135
      ]
    },
    {
      "name": "prefixReactivated",
      "discriminator": [
        67,
        17,
        46,
        224,
        226,
        173,
        49,
        90
      ]
    },
    {
      "name": "prefixRefunded",
      "discriminator": [
        185,
        77,
        232,
        59,
        97,
        175,
        246,
        251
      ]
    },
    {
      "name": "prefixRejected",
      "discriminator": [
        152,
        238,
        98,
        180,
        223,
        147,
        27,
        171
      ]
    },
    {
      "name": "prefixSubmitted",
      "discriminator": [
        212,
        152,
        202,
        170,
        29,
        251,
        149,
        39
      ]
    },
    {
      "name": "treasuryWithdraw",
      "discriminator": [
        164,
        41,
        149,
        134,
        248,
        87,
        41,
        218
      ]
    },
    {
      "name": "verifierAdded",
      "discriminator": [
        113,
        131,
        132,
        161,
        53,
        64,
        96,
        78
      ]
    },
    {
      "name": "verifierRemoved",
      "discriminator": [
        87,
        0,
        8,
        47,
        151,
        131,
        51,
        99
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorizedAdmin",
      "msg": "Unauthorized admin"
    },
    {
      "code": 6001,
      "name": "unauthorizedVerifier",
      "msg": "Unauthorized verifier"
    },
    {
      "code": 6002,
      "name": "invalidPrefixFormat",
      "msg": "Invalid prefix format"
    },
    {
      "code": 6003,
      "name": "prefixAlreadyExists",
      "msg": "Prefix already exists"
    },
    {
      "code": 6004,
      "name": "invalidPrefixStatus",
      "msg": "Prefix not in pending state"
    },
    {
      "code": 6005,
      "name": "insufficientFee",
      "msg": "Insufficient fee"
    },
    {
      "code": 6006,
      "name": "invalidMetadataHashLength",
      "msg": "Invalid metadata hash"
    },
    {
      "code": 6007,
      "name": "invalidMetadataUri",
      "msg": "Invalid metadata uri"
    },
    {
      "code": 6008,
      "name": "invalidTreasuryAccount",
      "msg": "Treasury not owned by program"
    },
    {
      "code": 6009,
      "name": "insufficientTreasuryBalance",
      "msg": "Insufficient treasury balance"
    },
    {
      "code": 6010,
      "name": "refundNotAllowed",
      "msg": "Refund not allowed in current state"
    },
    {
      "code": 6011,
      "name": "unauthorizedOwnerAction",
      "msg": "Only owner may perform this action"
    },
    {
      "code": 6012,
      "name": "missingBump",
      "msg": "Account bump missing"
    },
    {
      "code": 6013,
      "name": "feeOperationsPaused",
      "msg": "Fee operations paused"
    },
    {
      "code": 6014,
      "name": "prefixExpired",
      "msg": "Prefix expired"
    },
    {
      "code": 6015,
      "name": "authorityKeysTooMany",
      "msg": "Invalid authority keys length"
    },
    {
      "code": 6016,
      "name": "invalidEd25519Signature",
      "msg": "Invalid Ed25519 signature"
    }
  ],
  "types": [
    {
      "name": "feeRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "currentFee",
            "type": "u64"
          },
          {
            "name": "pause",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "feeUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "oldFee",
            "type": "u64"
          },
          {
            "name": "newFee",
            "type": "u64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "refHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "prefixStatus"
              }
            }
          },
          {
            "name": "authorityKeys",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "feePaid",
            "type": "u64"
          },
          {
            "name": "expiryAt",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "prefixActivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "authorityKeysLen",
            "type": "u8"
          },
          {
            "name": "activatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixApproved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "refHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "approvedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixAuthorityUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "oldAuthorityKeys",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "newAuthorityKeys",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixDeactivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixMetadataUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "oldMetadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "newMetadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixOwnerRecovered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "oldOwner",
            "type": "pubkey"
          },
          {
            "name": "newOwner",
            "type": "pubkey"
          },
          {
            "name": "feePaid",
            "type": "u64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixReactivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "refundedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixRejected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          },
          {
            "name": "rejectedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "prefixStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "active"
          },
          {
            "name": "rejected"
          },
          {
            "name": "inactive"
          }
        ]
      }
    },
    {
      "name": "prefixSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "prefix",
            "type": "string"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "metadataUri",
            "type": "string"
          },
          {
            "name": "feePaid",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "pendingPda",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "treasuryWithdraw",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "to",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "withdrawnAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifierAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "addedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifierRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "removedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifiersList",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "verifiers",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
