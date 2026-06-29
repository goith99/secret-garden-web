/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/secret_garden.json`.
 */
export type SecretGarden = {
  "address": "7eMfGCkXavfZeVrwRo3ZH63C7H6mZ6n1HZKJwGkZBddo",
  "metadata": {
    "name": "secretGarden",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Secret Garden Protocol — Stage 1 on-chain foundation"
  },
  "docs": [
    "Secret Garden Protocol.",
    "",
    "Stage 1: game config, player profiles, starter-flower claiming.",
    "Stage 2: flower ownership status + daily competition round lifecycle.",
    "Stage 3A: encrypted breeding — register the `breed` computation definition and",
    "queue breeding computations (the callback that persists results is Stage 3B)."
  ],
  "instructions": [
    {
      "name": "breedCallback",
      "docs": [
        "Callback invoked by the Arcium cluster once `breed` finishes.",
        "",
        "On success: writes the offspring genome to the pre-created FlowerRecord, commits to",
        "it, flips it Active, unlocks both parents, and Completes the experiment. On failure:",
        "unlocks both parents and marks the experiment Failed (the offspring stays Locked).",
        "Idempotent via `experiment.callback_processed` — a retried callback no-ops."
      ],
      "discriminator": [
        240,
        22,
        217,
        222,
        231,
        120,
        122,
        50
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "experiment",
          "writable": true
        },
        {
          "name": "profile",
          "writable": true
        },
        {
          "name": "flowerA",
          "writable": true
        },
        {
          "name": "flowerB",
          "writable": true
        },
        {
          "name": "offspring",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "breedOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "cancelExpiredExperiment",
      "docs": [
        "Permissionless recovery: after `EXPERIMENT_TIMEOUT_SECONDS`, anyone can expire a",
        "stuck Queued/Processing experiment to unlock the player's parents. This touches no",
        "Arcium/MPC state. It sets `callback_processed = true`, so if the MPC computation",
        "later completes anyway, `breed_callback`'s idempotency guard makes it a no-op —",
        "preventing a double `active_experiment_count` decrement or a second resolution.",
        "(Trade-off: a successful-but-late computation is discarded; the pre-created",
        "offspring stays Locked. The priority is recovering the player's parent flowers.)"
      ],
      "discriminator": [
        83,
        224,
        167,
        233,
        147,
        168,
        93,
        126
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone may call this; the caller only pays the transaction fee."
          ],
          "signer": true
        },
        {
          "name": "experiment",
          "writable": true
        },
        {
          "name": "profile",
          "writable": true
        },
        {
          "name": "flowerA",
          "writable": true
        },
        {
          "name": "flowerB",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelStuckScore",
      "docs": [
        "Permissionless recovery (Stage 5A): if a scoring computation was queued but its",
        "callback never landed, anyone can reset the entry's in-flight flag after",
        "`SCORE_TIMEOUT_SECONDS` so `queue_score_entry` can be called again. Mirrors",
        "`cancel_expired_experiment`. Nothing is \"unlocked\" (the entry's flower stays",
        "Submitted regardless), and `round.scored_count` is untouched — it is only ever",
        "incremented by the success callback, so a cancel-then-retry that eventually",
        "succeeds counts exactly once, and one that never succeeds counts zero. Works while",
        "paused: a stuck score must be recoverable even if new game actions are halted."
      ],
      "discriminator": [
        255,
        100,
        240,
        103,
        230,
        222,
        227,
        180
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone may call this; the caller only pays the transaction fee."
          ],
          "signer": true
        },
        {
          "name": "entry",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "claimStarters",
      "docs": [
        "Grants the caller their six starter flowers in a single approval. Callable once."
      ],
      "discriminator": [
        95,
        191,
        183,
        135,
        14,
        229,
        110,
        215
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "Wallet that owns (and funds) the new flowers."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "profile"
          ]
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to enforce the pause kill-switch."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "docs": [
            "Caller's profile. Must exist, belong to the signer, and not have claimed yet.",
            "",
            "The `starter_claimed` guard is the semantic one-time gate. Note that the six",
            "flower PDAs below are also unique, so a real re-claim additionally collides on",
            "`init` (\"account already in use\"); both reject the duplicate transaction."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "flower0",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  0,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "flower1",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  1,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "flower2",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  2,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "flower3",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  3,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "flower4",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  4,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "flower5",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "const",
                "value": [
                  5,
                  0,
                  0,
                  0
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeRound",
      "docs": [
        "Closes an Open round (round operator only; may close early or late)."
      ],
      "discriminator": [
        149,
        14,
        81,
        88,
        230,
        226,
        234,
        37
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Operator that opened the round."
          ],
          "signer": true,
          "relations": [
            "round"
          ]
        },
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "competitionRound"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "createProfile",
      "docs": [
        "Creates the caller's player profile. Callable once per wallet."
      ],
      "discriminator": [
        225,
        205,
        234,
        143,
        17,
        186,
        50,
        220
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "Wallet that owns (and funds) the new profile."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to enforce the pause kill-switch."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "finalizeRound",
      "docs": [
        "Finalizes a Closed round (round operator only). No scoring in Stage 2."
      ],
      "discriminator": [
        239,
        160,
        254,
        11,
        254,
        144,
        53,
        148
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Operator that opened the round."
          ],
          "signer": true,
          "relations": [
            "round"
          ]
        },
        {
          "name": "round",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "competitionRound"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initBreedingCompDef",
      "docs": [
        "Registers the `breed` computation definition on-chain. Authority-only, once."
      ],
      "discriminator": [
        24,
        99,
        218,
        248,
        224,
        72,
        56,
        134
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initRevealTop3CompDef",
      "docs": [
        "Registers the `reveal_top3` computation definition. Authority-only, once."
      ],
      "discriminator": [
        234,
        229,
        180,
        104,
        207,
        234,
        57,
        61
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initScoreEntryCompDef",
      "docs": [
        "Registers the `score_entry` computation definition. Authority-only, once.",
        "(Two init instructions because Arcium 0.10.4 binds one accounts struct, via",
        "`#[init_computation_definition_accounts]`, to exactly one circuit — a single",
        "`init_scoring_comp_defs` cannot register both.)"
      ],
      "discriminator": [
        239,
        112,
        133,
        5,
        53,
        143,
        112,
        77
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount",
          "writable": true
        },
        {
          "name": "compDefAccount",
          "writable": true
        },
        {
          "name": "addressLookupTable",
          "writable": true
        },
        {
          "name": "lutProgram",
          "address": "AddressLookupTab1e1111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "docs": [
        "Creates the singleton game config. Callable once."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Authority that funds and administers the game config."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "migrateProfile",
      "docs": [
        "Stage 5D migration: grows a pre-5D `PlayerProfile` (created with the smaller layout,",
        "before `breeds_this_round`/`last_breed_round` were appended) by 5 bytes so the",
        "current program can read it. Unlike `realloc_flower_genome`, the profile here is",
        "taken as a RAW account: the old layout is 5 bytes short of `PlayerProfile`, so loading",
        "it as `Account<PlayerProfile>` would fail with `AccountDidNotDeserialize` BEFORE any",
        "realloc constraint could run. We grow it in place, preserving the discriminator and",
        "every existing field, and zero-fill the two appended fields. Idempotent (a profile",
        "already at the new size is a no-op) and owner-only (the PDA seeds bind it to the",
        "signer). Runs regardless of the pause kill-switch — it is a recovery/maintenance op."
      ],
      "discriminator": [
        224,
        187,
        132,
        189,
        185,
        163,
        183,
        237
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "profile",
          "docs": [
            "`PlayerProfile`, so it cannot be loaded as a typed `Account`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "openRound",
      "docs": [
        "Opens the next competition round (authority only; previous round must be final)."
      ],
      "discriminator": [
        66,
        235,
        123,
        240,
        8,
        35,
        185,
        159
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Configured game authority; funds the new round account."
          ],
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "previousRound",
          "docs": [
            "The round at `config.current_round`. Required (and must be Finalized) for every",
            "round after the first; `None` only when `config.current_round == 0`."
          ],
          "optional": true
        },
        {
          "name": "round",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "queueRevealTop3",
      "docs": [
        "Queues the top-3 reveal for a Closed, fully-scored round. Authority-only.",
        "",
        "GAP 2 fix: the encrypted scores are NOT supplied by the caller. The round's",
        "`CompetitionEntry` accounts are passed as `remaining_accounts` (exactly",
        "`participant_count` of them); the program validates each belongs to the round and",
        "is scored, then builds the circuit args by reading each entry's stored score",
        "ciphertext in-place via `ArgBuilder::account()`. Slots beyond `participant_count`",
        "are padded with the first entry's (real, MAC-valid) score, which the circuit masks",
        "to 0 — so a caller can never substitute arbitrary score data."
      ],
      "discriminator": [
        10,
        142,
        131,
        193,
        153,
        60,
        109,
        162
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "round"
          ]
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to enforce the pause kill-switch (Stage 5A: reveal is game",
            "progression, so it is halted while paused; check added here, logic unchanged)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "round",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "competitionRound"
              }
            ]
          }
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "queueScoreEntry",
      "docs": [
        "Queues scoring of one entry's flower against the round's public target traits.",
        "Valid once the round is Closed and the entry has NOT already been scored (GAP 1",
        "guard; enforced by the `!entry.scored` constraint on `QueueScoreEntry`). Round",
        "authority signs. The genome is read in-place from the flower account."
      ],
      "discriminator": [
        143,
        38,
        115,
        182,
        177,
        80,
        113,
        57
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "round"
          ]
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to enforce the pause kill-switch (Stage 5A: scoring is game",
            "progression, so it is halted while paused; check added here, logic unchanged)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "round",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "competitionRound"
              }
            ]
          }
        },
        {
          "name": "entry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "round"
              },
              {
                "kind": "account",
                "path": "entry.player",
                "account": "competitionEntry"
              }
            ]
          }
        },
        {
          "name": "flowerRecord",
          "docs": [
            "The entry's flower; its encrypted genome is read in-place by the MPC."
          ]
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        }
      ]
    },
    {
      "name": "reallocFlowerGenome",
      "docs": [
        "Grows a `FlowerRecord` to the current (genome-bearing) layout via Anchor's",
        "`realloc` constraint. Flowers created by `claim_starters` are already full size",
        "(Anchor's `Account<FlowerRecord>` requires the full layout to deserialize), so",
        "this is an idempotent, owner-only migration/forward-compatibility safeguard."
      ],
      "discriminator": [
        234,
        54,
        77,
        231,
        155,
        229,
        63,
        252
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "flower",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "reclaimDeadOffspring",
      "docs": [
        "Permissionless recovery (Stage 5A): closes the pre-created offspring of a",
        "Failed/Expired breeding and returns its rent to the original player. All validity is",
        "enforced by the `ReclaimDeadOffspring` account constraints (experiment is dead, the",
        "offspring is the Locked flower bound to it both ways, rent destination == owner).",
        "Permissionless is safe because the rent destination is fixed to the flower's owner",
        "regardless of who calls — the caller gains nothing. Works while paused (recovery)."
      ],
      "discriminator": [
        156,
        25,
        91,
        219,
        210,
        5,
        88,
        140
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "Anyone may call this; the caller gains nothing (rent is fixed to the flower owner)."
          ],
          "signer": true
        },
        {
          "name": "experiment",
          "docs": [
            "The breeding experiment — must be Failed or Expired."
          ]
        },
        {
          "name": "offspring",
          "docs": [
            "The pre-created offspring tied to `experiment`. Reclaimable only if it is still",
            "`LOCKED` (a successful breeding would have flipped it `ACTIVE`) AND bound to the",
            "experiment in both directions. `close` returns its rent to `owner_recipient` and",
            "also prevents any double-close (the account no longer exists afterwards)."
          ],
          "writable": true
        },
        {
          "name": "ownerRecipient",
          "docs": [
            "Rent destination — must equal the flower's recorded owner (product decision: rent",
            "returns to the player who paid it, not the caller and not the operator).",
            "lamports. Constrained above to equal `offspring.owner`."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "revealTop3Callback",
      "docs": [
        "On success: maps each winning SLOT index back to its entry pubkey and writes",
        "top1/top2/top3 — but `top_k` only when `participant_count >= k` (GAP 3). Unfilled",
        "slots stay `Pubkey::default()`, which is unambiguous: a real entry is a program PDA",
        "and can never be at the all-zero default. Sets `scoring_revealed`. Idempotent: a",
        "duplicate callback on an already-revealed round no-ops."
      ],
      "discriminator": [
        161,
        9,
        188,
        95,
        33,
        30,
        235,
        195
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "round",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "revealTop3Output"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "scoreEntryCallback",
      "docs": [
        "On success: persists the entry's encrypted score, marks it `scored`, and bumps",
        "`round.scored_count` (saturating). Idempotent via `entry.scored` — a retried or",
        "raced callback no-ops, which is what makes the GAP 1 double-count structurally",
        "impossible even if `queue_score_entry` were somehow called twice before the first",
        "callback lands. On failure: records a sentinel error_code and leaves `scored =",
        "false` so the entry can be re-queued."
      ],
      "discriminator": [
        86,
        175,
        193,
        162,
        133,
        157,
        104,
        119
      ],
      "accounts": [
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "computationAccount"
        },
        {
          "name": "clusterAccount"
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "entry",
          "writable": true
        },
        {
          "name": "round",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "output",
          "type": {
            "defined": {
              "name": "signedComputationOutputs",
              "generics": [
                {
                  "kind": "type",
                  "type": {
                    "defined": {
                      "name": "scoreEntryOutput"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "setPaused",
      "docs": [
        "Operator kill-switch: sets `GameConfig::paused`. Authority-only (Stage 5A). The",
        "`paused` field has existed since Stage 1 but never had an instruction to set it."
      ],
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "authority",
          "docs": [
            "Must equal `config.authority`."
          ],
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newValue",
          "type": "bool"
        }
      ]
    },
    {
      "name": "startBreeding",
      "docs": [
        "Queues an encrypted breeding computation for the signer's two Active parents and",
        "records the `Experiment`. One wallet approval; the result is handled in Stage 3B.",
        "",
        "`env_*` carry the player's private environment encrypted as one",
        "`Enc<Shared, Environment>` (single pubkey + nonce + three `u8` ciphertexts). Each",
        "parent's kind/species/nonce are read from its `FlowerRecord`; the parent genome",
        "ciphertext is referenced in-place from the account (zeroed for Starters)."
      ],
      "discriminator": [
        147,
        52,
        156,
        44,
        4,
        145,
        133,
        210
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to enforce the pause kill-switch (Stage 5A: this player-facing",
            "instruction previously had no pause gate — added here, logic otherwise unchanged)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "flowerA",
          "writable": true
        },
        {
          "name": "flowerB",
          "writable": true
        },
        {
          "name": "experiment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  120,
                  112,
                  101,
                  114,
                  105,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "account",
                "path": "profile.total_experiments",
                "account": "playerProfile"
              }
            ]
          }
        },
        {
          "name": "offspring",
          "docs": [
            "Offspring flower, pre-created here (Arcium callbacks cannot init accounts). Its",
            "index is the wallet's running `total_flowers` (starters occupy 0..=5). The genome",
            "is written by `breed_callback`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  108,
                  111,
                  119,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "account",
                "path": "profile.next_flower_index",
                "account": "playerProfile"
              }
            ]
          }
        },
        {
          "name": "signPdaAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  65,
                  114,
                  99,
                  105,
                  117,
                  109,
                  83,
                  105,
                  103,
                  110,
                  101,
                  114,
                  65,
                  99,
                  99,
                  111,
                  117,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "mxeAccount"
        },
        {
          "name": "mempoolAccount",
          "writable": true
        },
        {
          "name": "executingPool",
          "writable": true
        },
        {
          "name": "computationAccount",
          "writable": true
        },
        {
          "name": "compDefAccount"
        },
        {
          "name": "clusterAccount",
          "writable": true
        },
        {
          "name": "poolAccount",
          "writable": true,
          "address": "G2sRWJvi3xoyh5k2gY49eG9L8YhAEWQPtNb1zb1GXTtC"
        },
        {
          "name": "clockAccount",
          "writable": true,
          "address": "7EbMUTLo5DjdzbN7s8BXeZwXzEwNQb1hScfRvWg8a6ot"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "arciumProgram",
          "address": "Arcj82pX7HxYKLR92qvgZUAd7vGS1k4hQvAFcPATFdEQ"
        }
      ],
      "args": [
        {
          "name": "computationOffset",
          "type": "u64"
        },
        {
          "name": "envPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "envNonce",
          "type": "u128"
        },
        {
          "name": "lightCiphertext",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "waterCiphertext",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "soilCiphertext",
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
      "name": "submitEntry",
      "docs": [
        "Submits one Active flower as an entry into an Open round."
      ],
      "discriminator": [
        150,
        212,
        114,
        178,
        207,
        212,
        216,
        222
      ],
      "accounts": [
        {
          "name": "player",
          "docs": [
            "The player submitting the entry; funds the entry account."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to enforce the pause kill-switch (Stage 5A: this player-facing",
            "instruction previously had no pause gate — added here, logic otherwise unchanged)."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "round",
          "docs": [
            "Target round. The seed check ties the passed account to its stored `round_id`."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  111,
                  117,
                  110,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "round.round_id",
                "account": "competitionRound"
              }
            ]
          }
        },
        {
          "name": "flowerRecord",
          "docs": [
            "Flower being submitted. Ownership and status are validated in the handler."
          ],
          "writable": true
        },
        {
          "name": "entry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  110,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "round"
              },
              {
                "kind": "account",
                "path": "player"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "arciumSignerAccount",
      "discriminator": [
        214,
        157,
        122,
        114,
        117,
        44,
        214,
        74
      ]
    },
    {
      "name": "competitionEntry",
      "discriminator": [
        56,
        249,
        157,
        19,
        217,
        29,
        102,
        199
      ]
    },
    {
      "name": "competitionRound",
      "discriminator": [
        236,
        99,
        59,
        254,
        35,
        143,
        142,
        20
      ]
    },
    {
      "name": "experiment",
      "discriminator": [
        93,
        88,
        219,
        4,
        130,
        32,
        125,
        30
      ]
    },
    {
      "name": "flowerRecord",
      "discriminator": [
        161,
        2,
        180,
        142,
        45,
        204,
        60,
        240
      ]
    },
    {
      "name": "gameConfig",
      "discriminator": [
        45,
        146,
        146,
        33,
        170,
        69,
        96,
        133
      ]
    },
    {
      "name": "playerProfile",
      "discriminator": [
        82,
        226,
        99,
        87,
        164,
        130,
        181,
        80
      ]
    }
  ],
  "events": [
    {
      "name": "breedingComputedEvent",
      "discriminator": [
        214,
        127,
        246,
        177,
        252,
        242,
        130,
        11
      ]
    },
    {
      "name": "scoreComputedEvent",
      "discriminator": [
        201,
        81,
        191,
        141,
        203,
        170,
        71,
        142
      ]
    },
    {
      "name": "top3RevealedEvent",
      "discriminator": [
        103,
        45,
        24,
        249,
        131,
        75,
        76,
        203
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "alreadyInitialized",
      "msg": "Game config has already been initialized"
    },
    {
      "code": 6001,
      "name": "notAuthority",
      "msg": "Signer is not the configured authority"
    },
    {
      "code": 6002,
      "name": "gamePaused",
      "msg": "The game is currently paused"
    },
    {
      "code": 6003,
      "name": "profileAlreadyExists",
      "msg": "A profile already exists for this wallet"
    },
    {
      "code": 6004,
      "name": "startersAlreadyClaimed",
      "msg": "Starter flowers have already been claimed"
    },
    {
      "code": 6005,
      "name": "invalidSpecies",
      "msg": "Species index is out of range"
    },
    {
      "code": 6006,
      "name": "previousRoundNotFinalized",
      "msg": "The previous round has not been finalized"
    },
    {
      "code": 6007,
      "name": "roundNotOpen",
      "msg": "The round is not open"
    },
    {
      "code": 6008,
      "name": "roundDeadlinePassed",
      "msg": "The round deadline has passed"
    },
    {
      "code": 6009,
      "name": "roundFull",
      "msg": "The round is full"
    },
    {
      "code": 6010,
      "name": "flowerNotOwned",
      "msg": "The flower is not owned by the signer"
    },
    {
      "code": 6011,
      "name": "flowerNotActive",
      "msg": "The flower is not active"
    },
    {
      "code": 6012,
      "name": "roundNotClosed",
      "msg": "The round is not closed"
    },
    {
      "code": 6013,
      "name": "parentsMustBeDistinct",
      "msg": "The two parents must be distinct flowers"
    },
    {
      "code": 6014,
      "name": "abortedComputation",
      "msg": "The computation was aborted"
    },
    {
      "code": 6015,
      "name": "experimentNotYetExpired",
      "msg": "The experiment has not yet expired"
    },
    {
      "code": 6016,
      "name": "experimentAlreadyResolved",
      "msg": "The experiment has already been resolved"
    },
    {
      "code": 6017,
      "name": "scoringIncomplete",
      "msg": "Not all entries have been scored yet"
    },
    {
      "code": 6018,
      "name": "scoringAlreadyRevealed",
      "msg": "Scoring has already been revealed"
    },
    {
      "code": 6019,
      "name": "entryAlreadyScored",
      "msg": "This entry has already been scored"
    },
    {
      "code": 6020,
      "name": "wrongEntryCount",
      "msg": "Wrong number of entry accounts for the round"
    },
    {
      "code": 6021,
      "name": "scoreAlreadyQueued",
      "msg": "A scoring computation is already in flight for this entry"
    },
    {
      "code": 6022,
      "name": "scoreNotQueued",
      "msg": "The entry is not currently queued for scoring"
    },
    {
      "code": 6023,
      "name": "scoreNotYetTimedOut",
      "msg": "The scoring computation has not yet timed out"
    },
    {
      "code": 6024,
      "name": "experimentNotDead",
      "msg": "The experiment is not in a failed or expired state"
    },
    {
      "code": 6025,
      "name": "offspringNotReclaimable",
      "msg": "The offspring is not a reclaimable dead flower for this experiment"
    },
    {
      "code": 6026,
      "name": "invalidRentDestination",
      "msg": "The rent destination must be the flower owner"
    },
    {
      "code": 6027,
      "name": "breedingLimitReached",
      "msg": "You have used all 5 breeding attempts for this round"
    }
  ],
  "types": [
    {
      "name": "activation",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "activationEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "deactivationEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          }
        ]
      }
    },
    {
      "name": "arciumSignerAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "bn254g2blsPublicKey",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "array": [
              "u8",
              64
            ]
          }
        ]
      }
    },
    {
      "name": "breedOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "breedOutputStruct0"
              }
            }
          }
        ]
      }
    },
    {
      "name": "breedOutputStruct0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "10"
                  }
                ]
              }
            }
          },
          {
            "name": "field1",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "breedingComputedEvent",
      "docs": [
        "Emitted by `breed_callback` when a breeding computation succeeds."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ciphertexts",
            "docs": [
              "The offspring genome ciphertext (10 scalars * 32 bytes)."
            ],
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                10
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "The MXE nonce (little-endian u128)."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "circuitSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "local",
            "fields": [
              {
                "defined": {
                  "name": "localCircuitSource"
                }
              }
            ]
          },
          {
            "name": "onChain",
            "fields": [
              {
                "defined": {
                  "name": "onChainCircuitSource"
                }
              }
            ]
          },
          {
            "name": "offChain",
            "fields": [
              {
                "defined": {
                  "name": "offChainCircuitSource"
                }
              }
            ]
          }
        ]
      }
    },
    {
      "name": "clockAccount",
      "docs": [
        "An account storing the current network epoch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "startEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "currentEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "startEpochTimestamp",
            "type": {
              "defined": {
                "name": "timestamp"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "cluster",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tdInfo",
            "type": {
              "option": {
                "defined": {
                  "name": "nodeMetadata"
                }
              }
            }
          },
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "clusterSize",
            "type": "u16"
          },
          {
            "name": "activation",
            "type": {
              "defined": {
                "name": "activation"
              }
            }
          },
          {
            "name": "maxCapacity",
            "type": "u64"
          },
          {
            "name": "cuPrice",
            "type": "u64"
          },
          {
            "name": "cuPriceProposals",
            "type": {
              "array": [
                "u64",
                32
              ]
            }
          },
          {
            "name": "lastUpdatedEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "nodes",
            "type": {
              "vec": {
                "defined": {
                  "name": "nodeRef"
                }
              }
            }
          },
          {
            "name": "pendingNodes",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "blsPublicKey",
            "type": {
              "defined": {
                "name": "setUnset",
                "generics": [
                  {
                    "kind": "type",
                    "type": {
                      "defined": {
                        "name": "bn254g2blsPublicKey"
                      }
                    }
                  }
                ]
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "competitionEntry",
      "docs": [
        "A player's entry into a round. PDA seeds: `[b\"entry\", round, player]`.",
        "",
        "The PDA is unique per (round, player), so the `init` constraint failing on a second",
        "submission is itself the duplicate-entry guard — no manual check is needed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "docs": [
              "The `CompetitionRound` this entry belongs to."
            ],
            "type": "pubkey"
          },
          {
            "name": "player",
            "docs": [
              "The player that submitted the entry."
            ],
            "type": "pubkey"
          },
          {
            "name": "flowerRecord",
            "docs": [
              "The `FlowerRecord` submitted to the round."
            ],
            "type": "pubkey"
          },
          {
            "name": "submittedAt",
            "docs": [
              "Unix timestamp the entry was submitted."
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "Entry status (see `ENTRY_STATUS_*`). Stage 2 only sets `SUBMITTED`."
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "encryptedScore",
            "docs": [
              "`Enc<Mxe, u8>` score ciphertext (zero until scored). Read in-place by",
              "`reveal_top3` via `ArgBuilder::account()` — the integrity fix that stops callers",
              "from supplying fabricated scores."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "scoreNonce",
            "docs": [
              "MXE nonce for `encrypted_score` (little-endian u128)."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "scored",
            "docs": [
              "True once `score_entry_callback` has persisted this entry's score. Gates re-queuing",
              "(`queue_score_entry` requires `scored == false`) and makes the callback idempotent."
            ],
            "type": "bool"
          },
          {
            "name": "scoreErrorCode",
            "docs": [
              "Failure code (0 = none); set by `score_entry_callback` on a failed computation."
            ],
            "type": "u16"
          },
          {
            "name": "scoreQueued",
            "docs": [
              "True while a scoring computation is in flight. Set by `queue_score_entry`; cleared",
              "by `score_entry_callback` (on success OR failure) and by `cancel_stuck_score`. Acts",
              "as the \"currently queued\" state: it blocks a second concurrent queue and is what",
              "`cancel_stuck_score` resets so a stuck (never-callback'd) entry becomes re-queueable."
            ],
            "type": "bool"
          },
          {
            "name": "queuedAt",
            "docs": [
              "Unix timestamp of the most recent `queue_score_entry` for this entry (0 until first",
              "queued). Drives the `cancel_stuck_score` timeout."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "competitionRound",
      "docs": [
        "A daily competition round. PDA seeds: `[b\"round\", round_id_le]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "docs": [
              "Monotonic round number (== `GameConfig::current_round` at open time)."
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "Lifecycle status (see `ROUND_STATUS_*`)."
            ],
            "type": "u8"
          },
          {
            "name": "startTime",
            "docs": [
              "Unix timestamp the round opened."
            ],
            "type": "i64"
          },
          {
            "name": "endTime",
            "docs": [
              "Submission deadline: `start_time + ROUND_DURATION_SECONDS`."
            ],
            "type": "i64"
          },
          {
            "name": "maxParticipants",
            "docs": [
              "Maximum number of entries allowed (see `MAX_PARTICIPANTS`)."
            ],
            "type": "u16"
          },
          {
            "name": "participantCount",
            "docs": [
              "Number of entries submitted so far."
            ],
            "type": "u16"
          },
          {
            "name": "authority",
            "docs": [
              "Operator that opened the round; the only signer allowed to close/finalize it."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "targetTraits",
            "docs": [
              "Public target trait ids for this round (see `TRAIT_TABLE`); only the first",
              "`target_trait_count` slots are active. Generated at `open_round` time."
            ],
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          },
          {
            "name": "targetTraitCount",
            "docs": [
              "Number of active trait slots (`TARGET_TRAIT_MIN..=TARGET_TRAIT_MAX`)."
            ],
            "type": "u8"
          },
          {
            "name": "top1",
            "docs": [
              "Winner `CompetitionEntry` pubkeys, `Pubkey::default()` until Stage 4B's",
              "`reveal_top3` callback fills them."
            ],
            "type": "pubkey"
          },
          {
            "name": "top2",
            "type": "pubkey"
          },
          {
            "name": "top3",
            "type": "pubkey"
          },
          {
            "name": "scoringRevealed",
            "docs": [
              "False until Stage 4B finalizes results."
            ],
            "type": "bool"
          },
          {
            "name": "scoredCount",
            "docs": [
              "Count of entries scored so far. Incremented by Stage 4B's `score_entry` callback",
              "(not written in Stage 4A); gates `queue_reveal_top3`."
            ],
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "computationDefinitionAccount",
      "docs": [
        "An account representing a [ComputationDefinition] in a MXE."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "deactivationSlot",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "cuAmount",
            "type": "u64"
          },
          {
            "name": "definition",
            "type": {
              "defined": {
                "name": "computationDefinitionMeta"
              }
            }
          },
          {
            "name": "circuitSource",
            "type": {
              "defined": {
                "name": "circuitSource"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                24
              ]
            }
          }
        ]
      }
    },
    {
      "name": "computationDefinitionMeta",
      "docs": [
        "A computation definition for execution in a MXE."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "circuitLen",
            "type": "u32"
          },
          {
            "name": "signature",
            "type": {
              "defined": {
                "name": "computationSignature"
              }
            }
          }
        ]
      }
    },
    {
      "name": "computationSignature",
      "docs": [
        "The signature of a computation defined in a [ComputationDefinition]."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "parameters",
            "type": {
              "vec": {
                "defined": {
                  "name": "parameter"
                }
              }
            }
          },
          {
            "name": "outputs",
            "type": {
              "vec": {
                "defined": {
                  "name": "output"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "epoch",
      "docs": [
        "The network epoch"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          "u64"
        ]
      }
    },
    {
      "name": "experiment",
      "docs": [
        "A breeding experiment: one queued (and later resolved) MPC computation.",
        "PDA seeds: `[b\"experiment\", owner, experiment_index_le]` where `experiment_index`",
        "is `PlayerProfile::total_experiments` at creation time."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Wallet that started the experiment."
            ],
            "type": "pubkey"
          },
          {
            "name": "parentA",
            "docs": [
              "First parent flower."
            ],
            "type": "pubkey"
          },
          {
            "name": "parentB",
            "docs": [
              "Second parent flower."
            ],
            "type": "pubkey"
          },
          {
            "name": "computationOffset",
            "docs": [
              "Arcium computation offset for this experiment's queued computation."
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "Lifecycle status (see `EXPERIMENT_STATUS_*`). Stage 3A only sets `QUEUED`."
            ],
            "type": "u8"
          },
          {
            "name": "resultFlower",
            "docs": [
              "Offspring flower, written by Stage 3B's callback (`Pubkey::default()` until then)."
            ],
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp the experiment was created."
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "docs": [
              "Unix timestamp of the last status change."
            ],
            "type": "i64"
          },
          {
            "name": "errorCode",
            "docs": [
              "Failure code (0 = none); set by Stage 3B on failure/expiry."
            ],
            "type": "u16"
          },
          {
            "name": "callbackProcessed",
            "docs": [
              "Whether Stage 3B's callback has already processed this experiment."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "feePool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "flowerRecord",
      "docs": [
        "One record per flower a wallet owns. PDA seeds: `[b\"flower\", owner, flower_index_le]`.",
        "",
        "NOTE: Stage 1 deliberately stores NO genome / commitment / ciphertext. Stage 3 will",
        "realloc this account to append encrypted-genome data once the Arcium circuit fixes",
        "the ciphertext size. `genome_status` already distinguishes Starter (0) from",
        "Encrypted (1) so client reload logic remains stable across stages."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Wallet that owns this flower."
            ],
            "type": "pubkey"
          },
          {
            "name": "flowerIndex",
            "docs": [
              "Index of this flower within the owner's collection (also a PDA seed)."
            ],
            "type": "u32"
          },
          {
            "name": "visualSpeciesId",
            "docs": [
              "Cosmetic species id used by the client renderer."
            ],
            "type": "u8"
          },
          {
            "name": "generation",
            "docs": [
              "Breeding generation (0 for starters)."
            ],
            "type": "u16"
          },
          {
            "name": "rarity",
            "docs": [
              "Rarity tier (see `RARITY_*`)."
            ],
            "type": "u8"
          },
          {
            "name": "stability",
            "docs": [
              "Genetic stability on a 0..=100 scale (100 for starters)."
            ],
            "type": "u8"
          },
          {
            "name": "revealedTraitMask",
            "docs": [
              "Bitmask of publicly revealed cosmetic traits (see `TRAIT_*`)."
            ],
            "type": "u32"
          },
          {
            "name": "parentA",
            "docs": [
              "First parent flower (default/zero for starters)."
            ],
            "type": "pubkey"
          },
          {
            "name": "parentB",
            "docs": [
              "Second parent flower (default/zero for starters)."
            ],
            "type": "pubkey"
          },
          {
            "name": "genomeStatus",
            "docs": [
              "Genome lifecycle marker (see `GENOME_STATUS_*`)."
            ],
            "type": "u8"
          },
          {
            "name": "sourceExperiment",
            "docs": [
              "Source breeding experiment (default/zero for starters)."
            ],
            "type": "pubkey"
          },
          {
            "name": "status",
            "docs": [
              "Lifecycle status (see `FLOWER_STATUS_*`)."
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp the flower was created."
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "genomeCommitment",
            "docs": [
              "Hash commitment to `encrypted_genome` (zero until a genome is attached)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "encryptedGenome",
            "docs": [
              "`Enc<Mxe, Genome>` ciphertext: 10 scalars * 32 bytes (see ENCRYPTED_GENOME_LEN)."
            ],
            "type": {
              "array": [
                "u8",
                320
              ]
            }
          },
          {
            "name": "encryptionMetadata",
            "docs": [
              "MXE nonce for `encrypted_genome` (little-endian u128 = 16 bytes)."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "gameConfig",
      "docs": [
        "Singleton game configuration. PDA seeds: `[b\"config\"]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Wallet allowed to administer the game (set at initialization)."
            ],
            "type": "pubkey"
          },
          {
            "name": "paused",
            "docs": [
              "Global kill-switch; when `true`, player-facing instructions are rejected."
            ],
            "type": "bool"
          },
          {
            "name": "currentRound",
            "docs": [
              "Current game round counter (advanced by later stages)."
            ],
            "type": "u64"
          },
          {
            "name": "starterCount",
            "docs": [
              "Number of starter flowers granted by `claim_starters`."
            ],
            "type": "u8"
          },
          {
            "name": "version",
            "docs": [
              "On-chain schema version (see `PROGRAM_VERSION`)."
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "localCircuitSource",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "mxeKeygen"
          },
          {
            "name": "mxeKeyRecoveryInit"
          },
          {
            "name": "mxeKeyRecoveryFinalize"
          }
        ]
      }
    },
    {
      "name": "mxeAccount",
      "docs": [
        "A MPC Execution Environment."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "padding",
            "type": "u8"
          },
          {
            "name": "cluster",
            "type": "u32"
          },
          {
            "name": "keygenOffset",
            "type": "u64"
          },
          {
            "name": "keyRecoveryInitOffset",
            "type": "u64"
          },
          {
            "name": "mxeProgramId",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "utilityPubkeys",
            "type": {
              "defined": {
                "name": "setUnset",
                "generics": [
                  {
                    "kind": "type",
                    "type": {
                      "defined": {
                        "name": "utilityPubkeys"
                      }
                    }
                  }
                ]
              }
            }
          },
          {
            "name": "lutOffsetSlot",
            "type": "u64"
          },
          {
            "name": "computationDefinitions",
            "type": {
              "vec": "u32"
            }
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "mxeStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "mxeEncryptedStruct",
      "generics": [
        {
          "kind": "const",
          "name": "len",
          "type": "usize"
        }
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u128"
          },
          {
            "name": "ciphertexts",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    32
                  ]
                },
                {
                  "generic": "len"
                }
              ]
            }
          }
        ]
      }
    },
    {
      "name": "mxeStatus",
      "docs": [
        "The status of an MXE."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "migration"
          }
        ]
      }
    },
    {
      "name": "nodeMetadata",
      "docs": [
        "location as [ISO 3166-1 alpha-2](https://www.iso.org/iso-3166-country-codes.html) country code"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ip",
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          },
          {
            "name": "peerId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "location",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "nodeRef",
      "docs": [
        "A reference to a node in the cluster.",
        "The offset is to derive the Node Account.",
        "The current_total_rewards is the total rewards the node has received so far in the current",
        "epoch."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offset",
            "type": "u32"
          },
          {
            "name": "currentTotalRewards",
            "type": "u64"
          },
          {
            "name": "vote",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "offChainCircuitSource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "source",
            "type": "string"
          },
          {
            "name": "hash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "onChainCircuitSource",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isCompleted",
            "type": "bool"
          },
          {
            "name": "uploadAuth",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "output",
      "docs": [
        "An output of a computation.",
        "We currently don't support encrypted outputs yet since encrypted values are passed via",
        "data objects."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "plaintextBool"
          },
          {
            "name": "plaintextU8"
          },
          {
            "name": "plaintextU16"
          },
          {
            "name": "plaintextU32"
          },
          {
            "name": "plaintextU64"
          },
          {
            "name": "plaintextU128"
          },
          {
            "name": "ciphertext"
          },
          {
            "name": "arcisX25519Pubkey"
          },
          {
            "name": "plaintextFloat"
          },
          {
            "name": "plaintextPoint"
          },
          {
            "name": "plaintextI8"
          },
          {
            "name": "plaintextI16"
          },
          {
            "name": "plaintextI32"
          },
          {
            "name": "plaintextI64"
          },
          {
            "name": "plaintextI128"
          }
        ]
      }
    },
    {
      "name": "parameter",
      "docs": [
        "A parameter of a computation.",
        "We differentiate between plaintext and encrypted parameters and data objects.",
        "Plaintext parameters are directly provided as their value.",
        "Encrypted parameters are provided as an offchain reference to the data.",
        "Data objects are provided as a reference to the data object account."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "plaintextBool"
          },
          {
            "name": "plaintextU8"
          },
          {
            "name": "plaintextU16"
          },
          {
            "name": "plaintextU32"
          },
          {
            "name": "plaintextU64"
          },
          {
            "name": "plaintextU128"
          },
          {
            "name": "ciphertext"
          },
          {
            "name": "arcisX25519Pubkey"
          },
          {
            "name": "arcisSignature"
          },
          {
            "name": "plaintextFloat"
          },
          {
            "name": "plaintextI8"
          },
          {
            "name": "plaintextI16"
          },
          {
            "name": "plaintextI32"
          },
          {
            "name": "plaintextI64"
          },
          {
            "name": "plaintextI128"
          },
          {
            "name": "plaintextPoint"
          }
        ]
      }
    },
    {
      "name": "playerProfile",
      "docs": [
        "Per-wallet player profile. PDA seeds: `[b\"profile\", owner]`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "docs": [
              "Wallet that owns this profile."
            ],
            "type": "pubkey"
          },
          {
            "name": "starterClaimed",
            "docs": [
              "Whether this wallet has already claimed its starter flowers."
            ],
            "type": "bool"
          },
          {
            "name": "totalFlowers",
            "docs": [
              "Total flowers owned (6 immediately after claiming starters)."
            ],
            "type": "u16"
          },
          {
            "name": "totalCrosses",
            "docs": [
              "Total successful crosses performed (Stage 2+)."
            ],
            "type": "u16"
          },
          {
            "name": "dailyAttempts",
            "docs": [
              "Breeding attempts used in the current day window (Stage 2+)."
            ],
            "type": "u8"
          },
          {
            "name": "finalSubmissions",
            "docs": [
              "Final submissions made to a challenge (Stage 4+)."
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp the profile was created."
            ],
            "type": "i64"
          },
          {
            "name": "activeExperimentCount",
            "docs": [
              "Breeding experiments currently in flight. Incremented by `start_breeding`",
              "(Stage 3A); decremented when an experiment resolves to Completed/Expired",
              "(Stage 3B's callback / cancel instructions)."
            ],
            "type": "u32"
          },
          {
            "name": "totalExperiments",
            "docs": [
              "Monotonic count of experiments ever started; never decremented. Used as the",
              "`experiment_index` nonce in the `Experiment` PDA so a wallet can run many",
              "concurrent experiments without seed collisions."
            ],
            "type": "u32"
          },
          {
            "name": "nextFlowerIndex",
            "docs": [
              "Monotonic next FlowerRecord index (PDA nonce). Starters occupy 0..=5, so this is",
              "`STARTER_COUNT` after claiming. A dedicated `u32` (rather than the `u16`",
              "`total_flowers`) keeps the flower PDA seed a clean 4-byte index and avoids a cast",
              "in the seed (which the IDL builder rejects)."
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "breedsThisRound",
            "docs": [
              "`start_breeding` attempts used in the round identified by `last_breed_round`",
              "(0..=`MAX_BREEDS_PER_ROUND`). Reset to 0 lazily on the first breed of a new round."
            ],
            "type": "u8"
          },
          {
            "name": "lastBreedRound",
            "docs": [
              "The `GameConfig::current_round` (truncated to `u32`) the player last bred in. When",
              "this differs from the live `current_round`, `breeds_this_round` is stale and resets."
            ],
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "revealTop3Output",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "revealTop3OutputStruct0"
              }
            }
          }
        ]
      }
    },
    {
      "name": "revealTop3OutputStruct0",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": "u16"
          },
          {
            "name": "field1",
            "type": "u8"
          },
          {
            "name": "field2",
            "type": "u16"
          },
          {
            "name": "field3",
            "type": "u8"
          },
          {
            "name": "field4",
            "type": "u16"
          },
          {
            "name": "field5",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "scoreComputedEvent",
      "docs": [
        "Emitted by the Stage 4A `score_entry` callback stub once a score verifies."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ciphertext",
            "docs": [
              "The encrypted score ciphertext (1 scalar * 32 bytes)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nonce",
            "docs": [
              "The MXE nonce (little-endian u128)."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scoreEntryOutput",
      "docs": [
        "The output of the callback instruction. Provided as a struct with ordered fields",
        "as anchor does not support tuples and tuple structs yet."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "field0",
            "type": {
              "defined": {
                "name": "mxeEncryptedStruct",
                "generics": [
                  {
                    "kind": "const",
                    "value": "1"
                  }
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "setUnset",
      "docs": [
        "Utility struct to store a value that needs to be set by a certain number of participants (keys",
        "in our case). Once all participants have set the value, the value is considered set and we only",
        "store it once."
      ],
      "generics": [
        {
          "kind": "type",
          "name": "t"
        }
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "set",
            "fields": [
              {
                "generic": "t"
              }
            ]
          },
          {
            "name": "unset",
            "fields": [
              {
                "generic": "t"
              },
              {
                "vec": "bool"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "signedComputationOutputs",
      "generics": [
        {
          "kind": "type",
          "name": "o"
        }
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "success",
            "fields": [
              {
                "generic": "o"
              },
              {
                "array": [
                  "u8",
                  64
                ]
              }
            ]
          },
          {
            "name": "failure"
          },
          {
            "name": "markerForIdlBuildDoNotUseThis",
            "fields": [
              {
                "generic": "o"
              }
            ]
          }
        ]
      }
    },
    {
      "name": "timestamp",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "top3RevealedEvent",
      "docs": [
        "Emitted by the Stage 4A `reveal_top3` callback stub. The winners are public."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "entryIndex1",
            "type": "u16"
          },
          {
            "name": "score1",
            "type": "u8"
          },
          {
            "name": "entryIndex2",
            "type": "u16"
          },
          {
            "name": "score2",
            "type": "u8"
          },
          {
            "name": "entryIndex3",
            "type": "u16"
          },
          {
            "name": "score3",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "utilityPubkeys",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "x25519Pubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ed25519VerifyingKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "elgamalPubkey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "pubkeyValidityProof",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    }
  ]
};
