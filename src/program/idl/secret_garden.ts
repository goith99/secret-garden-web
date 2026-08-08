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
      "name": "addOperator",
      "docs": [
        "Registers an additional operator wallet. Authority-only (enforced by `has_one`).",
        "Operators may run rounds (open/close/score/reveal/finalize) but cannot administer."
      ],
      "discriminator": [
        149,
        142,
        187,
        68,
        33,
        250,
        87,
        105
      ],
      "accounts": [
        {
          "name": "authority",
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
          "name": "newOperator",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "applyBracketResult",
      "docs": [
        "Writes the round's `top1/2/3` + `scoring_revealed` from the final reveal's result.",
        "",
        "This is the ONLY place the bracket touches `CompetitionRound`'s result fields, so",
        "every existing reader sees either an unrevealed round or the finished answer — never",
        "a partially-built bracket. Needs NO entry accounts: `queue_final_reveal` already",
        "stored the slot->pubkey mapping in `BracketState::finalists`."
      ],
      "discriminator": [
        193,
        82,
        122,
        11,
        213,
        64,
        34,
        110
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
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
        },
        {
          "name": "bracket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result"
        }
      ],
      "args": [
        {
          "name": "resultIndex",
          "type": "u8"
        }
      ]
    },
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
      "name": "closeFlower",
      "docs": [
        "V1: closes (deletes) one of the caller's own Active hybrid flowers, refunding its rent",
        "to the owner and freeing a collection slot (`total_flowers -= 1`). All validity is",
        "enforced by the `CloseFlower` account constraints:",
        "- `flower.owner == owner` (only your own flowers);",
        "- `flower.status == FLOWER_STATUS_ACTIVE` (excludes Locked mid-breed AND Submitted);",
        "- `flower.genome_status == GENOME_STATUS_ENCRYPTED` (starters are NEVER deletable —",
        "this is what preserves the `total_flowers - STARTER_COUNT` accounting invariant);",
        "- `!config.paused` (a player-facing action, unlike the recovery instructions).",
        "Anchor's `close = owner` returns the rent and prevents any double-close.",
        "",
        "The flower's PDA index is deliberately NOT reused: `next_flower_index` stays monotonic,",
        "so the closed index is retired forever (no PDA re-init risk); the freed slot is tracked",
        "purely by the `total_flowers` decrement."
      ],
      "discriminator": [
        86,
        204,
        169,
        186,
        222,
        121,
        136,
        11
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The flower's owner; signs, and receives the reclaimed rent."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Pause kill-switch: deleting is a player-facing action, blocked while paused."
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
            "Owner's profile — `total_flowers` is decremented to free the collection slot. The PDA",
            "seeds bind it to the signer, so it is necessarily the caller's own profile."
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
          "name": "flower",
          "docs": [
            "The flower to delete. `close = owner` refunds its rent to the owner; the constraints",
            "enforce ownership, that it is Active (not Locked/Submitted), and that it is a hybrid",
            "(never a starter). No `seeds` needed: Anchor proves it is a program-owned FlowerRecord,",
            "and the `owner` constraint proves it belongs to the signer."
          ],
          "writable": true
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
            "Authority or operator. (Field kept named `authority` so existing clients/IDL keys",
            "are unchanged; the actual authorization is the runtime operator-or-authority check.)"
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to authorize the signer (authority or operator). No pause gate:",
            "closing a round is winding down in-flight game state, which must work while paused."
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
      "name": "closeTier1Bracket",
      "docs": [
        "Closes a round's `Tier1State`, returning its rent, so the tier-1 partition can be",
        "re-pinned from scratch. Operator or authority, and only while the round is still",
        "unrevealed — a finished round's bracket is never disturbed.",
        "",
        "Needed because `init_tier1_bracket` uses `init` (not `init_if_needed`): pinning a",
        "partition is a one-shot act, so re-running it must be an explicit reset rather than a",
        "silent overwrite. It is also the only way to recover a `Tier1State` written under an",
        "older account layout, whose length no longer matches `size_of::<Tier1State>()`."
      ],
      "discriminator": [
        194,
        156,
        68,
        90,
        57,
        20,
        159,
        164
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "tier1",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "collectSemifinalWinners",
      "docs": [
        "Resolves one semifinal's slots into `BracketState::finalists`. Needs NO entry",
        "accounts: the slice is `Tier1State::winners[start..]`, already on-chain and sorted.",
        "From here the FINAL reveal and `apply_bracket_result` run exactly as they do for a",
        "single-tier round."
      ],
      "discriminator": [
        213,
        32,
        129,
        168,
        66,
        45,
        34,
        52
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
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
          "name": "tier1",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "bracket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result"
        }
      ],
      "args": [
        {
          "name": "semiIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "collectShardWinners",
      "docs": [
        "Resolves one shard's revealed SLOT indices into entry pubkeys and records them as",
        "finalists. The shard's entries must be supplied in the SAME ascending order used by",
        "`queue_shard_reveal`, which the same bounds checks re-verify here — so a caller",
        "cannot re-map slots onto different entries after the fact.",
        "",
        "No MPC and no `queue_computation`, so this is not subject to the 14-account",
        "argument ceiling; it is an ordinary instruction with `shard_size` extra accounts."
      ],
      "discriminator": [
        85,
        225,
        229,
        245,
        224,
        57,
        226,
        48
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
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
          "name": "bracket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result"
        }
      ],
      "args": [
        {
          "name": "shardIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "collectTier1Winners",
      "docs": [
        "Resolves one tier-1 shard's revealed slots into entry pubkeys and inserts them into",
        "`Tier1State::winners` IN SORTED ORDER. Sorting here is what lets the semifinal tier",
        "be partitioned and verified purely by index later."
      ],
      "discriminator": [
        81,
        146,
        235,
        202,
        150,
        142,
        4,
        48
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
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
          "name": "tier1",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result"
        }
      ],
      "args": [
        {
          "name": "shardIndex",
          "type": "u8"
        }
      ]
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
            "Authority or operator. (Field kept named `authority` for client/IDL stability; the",
            "authorization is the runtime operator-or-authority check.)"
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Game config, read to authorize the signer (authority or operator). No pause gate:",
            "finalizing winds down in-flight game state, which must work while paused."
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
      "name": "initBracket",
      "docs": [
        "Pins the shard partition for a Closed, fully-scored round. Operator or authority.",
        "",
        "`shard_bounds[k]` is the FIRST entry pubkey of shard `k` when the round's entries",
        "are sorted ascending by their PDA address — a canonical order anyone can recompute",
        "offline (fetch the round's entries, sort by pubkey, chunk by `shard_sizes`).",
        "Recording it once here is what lets each later shard call be verified independently",
        "without ever re-reading all `participant_count` entries in one transaction."
      ],
      "discriminator": [
        4,
        131,
        68,
        80,
        230,
        93,
        243,
        202
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "bracket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
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
          "name": "shardSizes",
          "type": {
            "array": [
              "u8",
              4
            ]
          }
        },
        {
          "name": "shardBounds",
          "type": {
            "array": [
              "pubkey",
              4
            ]
          }
        },
        {
          "name": "shardCount",
          "type": "u8"
        }
      ]
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
      "name": "initPrivateHintCompDef",
      "docs": [
        "Registers the `private_hint` computation definition on-chain. Authority-only, once.",
        "Same shape as the other `init_*_comp_def` instructions."
      ],
      "discriminator": [
        35,
        102,
        57,
        10,
        248,
        62,
        130,
        166
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
      "name": "initRevealTop3V3CompDef",
      "docs": [
        "Registers the `reveal_top3_v3` computation definition. Authority-only, once.",
        "ADDITIVE, VERIFICATION-ONLY — see `COMP_DEF_OFFSET_REVEAL_TOP3_V3`."
      ],
      "discriminator": [
        199,
        7,
        221,
        250,
        154,
        155,
        83,
        108
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
      "name": "initTier1Bracket",
      "docs": [
        "Pins the tier-1 partition for a round too large for one tier. Operator or authority."
      ],
      "discriminator": [
        249,
        206,
        137,
        241,
        117,
        146,
        25,
        214
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "tier1",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
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
          "name": "shardSizes",
          "type": {
            "array": [
              "u8",
              17
            ]
          }
        },
        {
          "name": "shardBounds",
          "type": {
            "array": [
              "pubkey",
              17
            ]
          }
        },
        {
          "name": "shardCount",
          "type": "u8"
        }
      ]
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
      "name": "migrateConfig",
      "docs": [
        "Grows the singleton `GameConfig` to the multi-operator layout (appends `operators`",
        "and `operator_count`) and zero-initializes the new fields. Authority-only.",
        "",
        "Like `migrate_profile`, the config is taken as a RAW account: a pre-operator config",
        "is shorter than the current `GameConfig`, so loading it as `Account<GameConfig>` would",
        "fail with `AccountDidNotDeserialize` BEFORE any realloc constraint could run. We grow",
        "it in place, preserving the discriminator and every existing field; `resize`",
        "zero-fills the appended bytes, so `operators = [Pubkey::default(); 3]` and",
        "`operator_count = 0`. Idempotent: a config already at (or above) the new size is a",
        "no-op. Authority is verified by reading the stored authority pubkey directly, since",
        "the raw account cannot be `has_one`-checked. Runs regardless of the pause kill-switch."
      ],
      "discriminator": [
        92,
        131,
        58,
        105,
        210,
        154,
        224,
        193
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "`GameConfig`, so it cannot be loaded as a typed `Account`."
          ],
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
            "Authority or operator running the round; funds the new round account."
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
      "name": "privateHintCallback",
      "docs": [
        "Callback invoked by the Arcium cluster once `private_hint` finishes. Persists the",
        "sealed bitmask (ciphertext + nonce + encryption key) into the player's `HintResult`",
        "and flips `ready = true`. On failure it leaves `ready = false` so the client keeps",
        "showing \"no hint yet\" and the player can simply re-request. There is no idempotency",
        "flag to guard: a duplicate success callback just rewrites the identical sealed bytes."
      ],
      "discriminator": [
        228,
        122,
        55,
        12,
        18,
        243,
        118,
        100
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
          "name": "hintResult",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "hint_result.player",
                "account": "hintResult"
              }
            ]
          }
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
                      "name": "privateHintOutput"
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
      "name": "promoteTier1",
      "docs": [
        "Promotes tier 1 into the semifinal tier: derives a balanced partition over the SORTED",
        "winners and writes it into `BracketState`, which from here on is the ordinary",
        "single-tier bracket over those winners.",
        "",
        "The partition is COMPUTED, not supplied — the winners are already sorted on-chain, so",
        "there is nothing for an operator to get wrong and nothing to verify."
      ],
      "discriminator": [
        52,
        48,
        157,
        161,
        123,
        128,
        158,
        39
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "tier1",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "bracket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
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
      "name": "queuePrivateHint",
      "docs": [
        "Queues a `private_hint` computation for one of the SIGNER'S OWN flowers against the",
        "CURRENT open round's public target traits. The MPC seals a 1-byte trait-satisfaction",
        "bitmask to the player's supplied x25519 key, so only they can decrypt the answer.",
        "",
        "Guards (all enforced by `QueuePrivateHint`'s account constraints, so they fail cleanly",
        "with a specific error rather than doing nothing):",
        "- the flower is owned by the signer and is NOT Locked (mid-breed) — Active or",
        "Submitted flowers are both hint-checkable;",
        "- the round is the current one AND is Open (`NoActiveRound` otherwise).",
        "",
        "`hint_pubkey` / `hint_nonce` are the player's sealing key material (same shape as",
        "`start_breeding`'s `env_pubkey` / `env_nonce`). The genome ciphertext is read in-place",
        "from the flower account (never supplied by the caller), exactly like `queue_score_entry`."
      ],
      "discriminator": [
        128,
        59,
        222,
        235,
        201,
        86,
        8,
        20
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "round",
          "docs": [
            "The round to check against — it must be the current OPEN round. `NoActiveRound`",
            "(rather than a silent no-op) if it is Closed/Finalized. Self-referential seeds prove",
            "it is a genuine `CompetitionRound` PDA."
          ],
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
          "name": "flower",
          "docs": [
            "The player's own flower. Its encrypted genome is read in-place by the MPC (never",
            "supplied by the caller). Must be owned by the signer and not Locked — a hint is",
            "checkable for Active OR Submitted flowers, just not one that is mid-breed."
          ]
        },
        {
          "name": "hintResult",
          "docs": [
            "The single overwritable per-player hint account. `init_if_needed`: created on the",
            "first request, reused (overwritten) on every later one."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  105,
                  110,
                  116
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
          "name": "hintPubkey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "hintNonce",
          "type": "u128"
        }
      ]
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
          "signer": true
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
      "name": "queueRevealTop3V3",
      "docs": [
        "ADDITIVE, VERIFICATION-ONLY twin of `queue_reveal_top3` targeting the",
        "`reveal_top3_v3` circuit. Argument construction is a DELIBERATE copy of",
        "`queue_reveal_top3`'s — same guards, same in-place `ArgBuilder::account()` reads at",
        "`ENTRY_SCORE_OFFSET`, same first-entry padding — so v3 receives the byte-identical",
        "argument vector the live circuit receives. Only the comp-def offset, the callback",
        "and the result account differ. The live reveal path is untouched."
      ],
      "discriminator": [
        100,
        178,
        162,
        215,
        53,
        129,
        159,
        219
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "result",
          "docs": [
            "Per-round v3 result record. `init_if_needed` so the round can be re-run."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  112,
                  51,
                  118,
                  51
                ]
              },
              {
                "kind": "account",
                "path": "round"
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
          "signer": true
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
      "name": "queueSemifinalReveal",
      "docs": [
        "Reveals ONE semifinal: ranks a contiguous slice of the sorted tier-1 winners.",
        "",
        "Membership is checked BY INDEX against `Tier1State::winners` — the supplied accounts",
        "must be exactly `winners[start..start+size]`. That is strictly stronger than the",
        "bounds check tier 1 uses, because the winners are already sorted on-chain."
      ],
      "discriminator": [
        163,
        59,
        62,
        172,
        233,
        34,
        236,
        174
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "tier1",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "bracket",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result",
          "writable": true
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
          "name": "semiIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "queueShardReveal",
      "docs": [
        "Reveals ONE shard: the shard's entries arrive as `remaining_accounts` in strictly",
        "ascending pubkey order and are fed to `reveal_top3_v3` exactly the way",
        "`queue_reveal_top3_v3` feeds a whole round — same in-place `ArgBuilder::account()`",
        "reads at `ENTRY_SCORE_OFFSET`, same first-entry padding of the unused slots.",
        "",
        "The result lands in a PER-SHARD `RevealTop3V3Result` PDA, so the existing",
        "`reveal_top3_v3_callback` is reused verbatim and the callback carries a CONSTANT 7",
        "accounts regardless of round size."
      ],
      "discriminator": [
        255,
        68,
        105,
        16,
        42,
        167,
        171,
        92
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "bracket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  114,
                  97,
                  99,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result",
          "docs": [
            "Per-shard result. Typed `RevealTop3V3Result` so the EXISTING",
            "`reveal_top3_v3_callback` writes it with no new circuit or callback."
          ],
          "writable": true
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
          "name": "shardIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "queueTier1ShardReveal",
      "docs": [
        "Reveals ONE tier-1 shard. Identical argument construction to `queue_shard_reveal` —",
        "same in-place `ArgBuilder::account()` reads, same first-entry padding, same",
        "`reveal_top3_v3` circuit and callback. Only the partition it validates against and",
        "the account it belongs to differ."
      ],
      "discriminator": [
        130,
        77,
        3,
        145,
        11,
        216,
        199,
        21
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
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
          "name": "tier1",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  101,
                  114,
                  49
                ]
              },
              {
                "kind": "account",
                "path": "round"
              }
            ]
          }
        },
        {
          "name": "result",
          "writable": true
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
          "name": "shardIndex",
          "type": "u8"
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
        "regardless of who calls — the caller gains nothing. Works while paused (recovery).",
        "",
        "V1 (Option A) accounting: the dead offspring was counted in `total_flowers` at",
        "`start_breeding` time (`+= 1`, done unconditionally for every started breed). Closing",
        "its account here must therefore decrement `total_flowers`, or the collection cap would",
        "permanently over-count phantom hybrids from failed breeds. This keeps",
        "`total_flowers - STARTER_COUNT` an exact live-hybrid count."
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
        },
        {
          "name": "profile",
          "docs": [
            "The offspring owner's profile — decremented so `total_flowers` stops counting this",
            "reclaimed dead hybrid (V1 Option A accounting). The PDA seeds bind it to",
            "`offspring.owner`, so a permissionless caller cannot substitute a different profile.",
            "(Declared after `offspring` so its `owner` field is available to the seeds.)"
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
                "path": "offspring.owner",
                "account": "flowerRecord"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "releaseFlower",
      "docs": [
        "Returns a flower that competed in a now-Finalized round to the player's collection",
        "(Submitted -> Active). Owner-only, and only once the round is fully Finalized —",
        "see `ReleaseFlower` for the full constraint rationale. Does NOT touch",
        "`total_flowers` (`submit_entry` never decremented it)."
      ],
      "discriminator": [
        118,
        112,
        11,
        62,
        122,
        195,
        85,
        122
      ],
      "accounts": [
        {
          "name": "owner",
          "docs": [
            "The flower's owner. Signs; pays nothing beyond the transaction fee."
          ],
          "signer": true
        },
        {
          "name": "config",
          "docs": [
            "Pause kill-switch: releasing is a player-facing action, blocked while paused."
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
          "docs": [
            "The round the flower competed in. Must be fully Finalized — see the gate note above."
          ],
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
          "docs": [
            "The caller's entry in that round. KEPT (never closed) — it is the round's permanent",
            "record, and `round.top1/2/3` name entry pubkeys — but its `status` is flipped to",
            "`ENTRY_STATUS_RELEASED` so each entry can release its flower exactly ONCE. See",
            "`ENTRY_STATUS_RELEASED` for the replay this closes."
          ],
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
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "flower",
          "docs": [
            "The flower to release. No `seeds` needed: Anchor proves it is a program-owned",
            "`FlowerRecord`, the `owner` constraint proves it belongs to the signer, and the",
            "`entry.flower_record` constraint above pins it to this specific entry."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "removeOperator",
      "docs": [
        "Removes a registered operator by pubkey, shifting the array left to keep the active",
        "slots contiguous. Authority-only (`has_one`) — operators cannot remove themselves or",
        "each other, so a leaked operator key cannot clean up its own tracks."
      ],
      "discriminator": [
        84,
        183,
        126,
        251,
        137,
        150,
        214,
        134
      ],
      "accounts": [
        {
          "name": "authority",
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
          "name": "operator",
          "type": "pubkey"
        }
      ]
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
      "name": "revealTop3V3Callback",
      "docs": [
        "ADDITIVE, VERIFICATION-ONLY callback for `reveal_top3_v3`. Records the circuit's RAW",
        "output into `RevealTop3V3Result`. It deliberately does NOT",
        "touch `CompetitionRound` — not `top1/2/3`, not `scoring_revealed` — so it can run on",
        "the same round as the live reveal without disturbing it."
      ],
      "discriminator": [
        34,
        204,
        3,
        7,
        104,
        157,
        53,
        15
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
          "name": "result",
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
                      "name": "revealTop3V3Output"
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
      "name": "scoreEntryV2Callback",
      "docs": [
        "On success: persists the entry's encrypted score, marks it `scored`, and bumps",
        "`round.scored_count` (saturating). Idempotent via `entry.scored` — a retried or",
        "raced callback no-ops, which is what makes the GAP 1 double-count structurally",
        "impossible even if `queue_score_entry` were somehow called twice before the first",
        "callback lands. On failure: records a sentinel error_code and leaves `scored =",
        "false` so the entry can be re-queued."
      ],
      "discriminator": [
        6,
        35,
        139,
        242,
        77,
        136,
        130,
        77
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
                      "name": "scoreEntryV2Output"
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
      "name": "bracketState",
      "discriminator": [
        32,
        254,
        172,
        106,
        171,
        102,
        119,
        104
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
      "name": "hintResult",
      "discriminator": [
        10,
        205,
        34,
        242,
        106,
        37,
        56,
        253
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
    },
    {
      "name": "revealTop3V3Result",
      "discriminator": [
        7,
        13,
        123,
        158,
        223,
        124,
        176,
        76
      ]
    },
    {
      "name": "tier1State",
      "discriminator": [
        105,
        19,
        19,
        149,
        93,
        45,
        180,
        47
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
      "name": "hintComputedEvent",
      "discriminator": [
        123,
        187,
        193,
        188,
        41,
        253,
        116,
        196
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
    },
    {
      "code": 6028,
      "name": "operatorSlotsFull",
      "msg": "All operator slots are full (max 3)"
    },
    {
      "code": 6029,
      "name": "operatorAlreadyExists",
      "msg": "That operator is already registered"
    },
    {
      "code": 6030,
      "name": "operatorNotFound",
      "msg": "That operator was not found"
    },
    {
      "code": 6031,
      "name": "invalidOperator",
      "msg": "Invalid operator pubkey"
    },
    {
      "code": 6032,
      "name": "roundTooRecentToClose",
      "msg": "The round has been open too briefly for an operator to close it"
    },
    {
      "code": 6033,
      "name": "noActiveRound",
      "msg": "There is no active (open) round to request a hint for"
    },
    {
      "code": 6034,
      "name": "collectionFull",
      "msg": "Your hybrid collection is full; delete some flowers to breed more"
    },
    {
      "code": 6035,
      "name": "starterNotDeletable",
      "msg": "Starter flowers cannot be deleted"
    },
    {
      "code": 6036,
      "name": "invalidShardLayout",
      "msg": "The declared shard layout is invalid for this round"
    },
    {
      "code": 6037,
      "name": "shardEntriesOutOfRange",
      "msg": "Shard entries must be strictly ascending and within this shard's bounds"
    },
    {
      "code": 6038,
      "name": "invalidShardIndex",
      "msg": "That shard index does not exist in this bracket"
    },
    {
      "code": 6039,
      "name": "shardResultNotReady",
      "msg": "That shard's reveal has not produced a result yet"
    },
    {
      "code": 6040,
      "name": "shardAlreadyCollected",
      "msg": "That shard's winners were already collected"
    },
    {
      "code": 6041,
      "name": "bracketNotReady",
      "msg": "Every shard must be revealed and collected before the final reveal"
    },
    {
      "code": 6042,
      "name": "bracketAlreadyFinal",
      "msg": "The final reveal has already been queued or applied"
    },
    {
      "code": 6043,
      "name": "finalistMismatch",
      "msg": "The supplied finalists do not match the recorded shard winners"
    },
    {
      "code": 6044,
      "name": "bracketRoundMismatch",
      "msg": "This bracket does not belong to that round"
    },
    {
      "code": 6045,
      "name": "wrongBracketTier",
      "msg": "This round's size does not match the bracket tier being used"
    },
    {
      "code": 6046,
      "name": "tier1NotReady",
      "msg": "Every tier-1 shard must be collected before promotion"
    },
    {
      "code": 6047,
      "name": "tier1AlreadyPromoted",
      "msg": "Tier 1 has already been promoted to the semifinal tier"
    },
    {
      "code": 6048,
      "name": "semifinalNotReady",
      "msg": "The semifinal tier is not ready — promote tier 1 first"
    },
    {
      "code": 6049,
      "name": "semifinalSliceMismatch",
      "msg": "The supplied accounts are not this semifinal's slice of the tier-1 winners"
    },
    {
      "code": 6050,
      "name": "tier1WinnerRejected",
      "msg": "Could not record that tier-1 winner (duplicate or capacity reached)"
    },
    {
      "code": 6051,
      "name": "staleRevealResult",
      "msg": "This reveal result belongs to a superseded partition (stale generation)"
    },
    {
      "code": 6052,
      "name": "roundNotFinalized",
      "msg": "The round is not finalized"
    },
    {
      "code": 6053,
      "name": "flowerNotSubmitted",
      "msg": "The flower is not submitted"
    },
    {
      "code": 6054,
      "name": "entryMismatch",
      "msg": "That entry does not match the supplied round and flower"
    },
    {
      "code": 6055,
      "name": "entryAlreadyReleased",
      "msg": "That entry has already released its flower"
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
      "name": "bracketState",
      "docs": [
        "Per-round bracket tracker. PDA seeds: `[BRACKET_SEED, round]`. ADDITIVE.",
        "",
        "WHY THIS EXISTS. A single Arcium computation may reference at most",
        "`MAX_REVEAL_ACCOUNT_REFS` (14) distinct accounts in its argument list, so a round",
        "larger than that cannot be revealed by one `reveal_top3_v3` call. This account tracks a",
        "two-level reveal: several shard reveals, then one final reveal over the shard winners.",
        "",
        "THE PARTITION IS PINNED HERE, NOT TRUSTED. `init_bracket` records `shard_sizes` and",
        "`shard_bounds` (the FIRST entry pubkey of each shard) once. Every `queue_shard_reveal`",
        "then re-derives nothing — it VERIFIES that the supplied entry accounts are strictly",
        "ascending by pubkey, start exactly at this shard's bound, and stay below the next",
        "shard's bound. Strict ordering + disjoint declared intervals + `sum(shard_sizes) ==",
        "participant_count` proves the shards are a partition of exactly the round's entries,",
        "so the operator cannot drop, duplicate or smuggle in an entry.",
        "",
        "`CompetitionRound::top1/2/3` and `scoring_revealed` stay UNTOUCHED until",
        "`apply_bracket_result` runs at the very end, so anything reading a round today sees",
        "either \"not revealed\" or the final answer — never a half-finished bracket."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "docs": [
              "The round this bracket belongs to (also the PDA seed)."
            ],
            "type": "pubkey"
          },
          {
            "name": "shardCount",
            "docs": [
              "Number of shards in use (1..=`MAX_SHARDS`)."
            ],
            "type": "u8"
          },
          {
            "name": "shardSizes",
            "docs": [
              "Entries in each shard; only the first `shard_count` slots are meaningful."
            ],
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          },
          {
            "name": "shardBounds",
            "docs": [
              "FIRST entry pubkey of each shard, ascending. Defines the partition boundaries."
            ],
            "type": {
              "array": [
                "pubkey",
                4
              ]
            }
          },
          {
            "name": "shardsCollected",
            "docs": [
              "Bit `k` set once shard `k`'s winners have been collected into `finalists`."
            ],
            "type": "u8"
          },
          {
            "name": "finalists",
            "docs": [
              "Shard winners in shard order, then rank order within a shard. Re-sorted into",
              "pubkey-ascending order by `queue_final_reveal`'s caller and verified there."
            ],
            "type": {
              "array": [
                "pubkey",
                12
              ]
            }
          },
          {
            "name": "finalistCount",
            "docs": [
              "How many slots of `finalists` are filled."
            ],
            "type": "u8"
          },
          {
            "name": "finalQueued",
            "docs": [
              "Set once the final reveal has been queued (blocks a second concurrent queue)."
            ],
            "type": "bool"
          },
          {
            "name": "applied",
            "docs": [
              "Set by `apply_bracket_result` once the round's top1/2/3 have been written."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "generation",
            "docs": [
              "Monotonic re-init counter, bumped by EVERY `init_bracket` (and `promote_tier1`) call.",
              "Every shard/semifinal/final `RevealTop3V3Result` is stamped with the generation current",
              "at queue time; `collect_*`/`apply` reject any result whose generation != this. That",
              "makes a re-init (which resets `shards_collected`/`finalists` but leaves the per-shard",
              "result PDAs intact and `ready`) unable to smuggle a stale, differently-partitioned",
              "result back in. `BracketState` persists across re-inits (`init_if_needed`), so a plain",
              "counter strictly increases and never collides. (APPENDED — old brackets are finalized",
              "and never re-read, so no migration is needed.)"
            ],
            "type": "u32"
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
          },
          {
            "name": "currentEpochTotalRewards",
            "type": "u64"
          },
          {
            "name": "rewardsEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "leaderSelector",
            "type": {
              "defined": {
                "name": "leaderSelector"
              }
            }
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
          },
          {
            "name": "operators",
            "docs": [
              "Up to three additional operator wallets allowed to run rounds (open/close/score/",
              "reveal/finalize). Only the first `operator_count` slots are active; the rest are",
              "`Pubkey::default()`. Operators CANNOT add/remove operators, pause, or upgrade."
            ],
            "type": {
              "array": [
                "pubkey",
                3
              ]
            }
          },
          {
            "name": "operatorCount",
            "docs": [
              "Number of active entries in `operators` (0..=3)."
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "hintComputedEvent",
      "docs": [
        "Emitted by `private_hint_callback` when a hint is sealed and ready. Carries no secret",
        "data — only the player + round so a client can react (the bitmask stays encrypted)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "hintResult",
      "docs": [
        "Per-player Private Hint result. PDA seeds: `[b\"hint\", player]` — exactly ONE account per",
        "player, OVERWRITTEN on each new `queue_private_hint` (hints are transient/informational,",
        "so no history is kept on-chain and rent stays bounded to one small account per player).",
        "",
        "Created (or reset to `ready = false`) at queue time; the sealed ciphertext is written by",
        "`private_hint_callback`. `ready` is the \"no hint yet\" vs \"hint ready\" flag: a freshly",
        "queued (or never-computed) result reads `ready == false`, so a client never mistakes a",
        "stale/blank ciphertext for a fresh answer. The ciphertext is `Enc<Shared, u8>` sealed to",
        "this `player`'s x25519 key; only they can decrypt it (see the `private_hint` circuit)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "docs": [
              "The player this hint belongs to (also the PDA seed). Only this wallet's sealing key",
              "can decrypt `ciphertext`."
            ],
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "docs": [
              "The `round_id` whose target traits the latest hint was computed against. Lets a client",
              "detect a hint left over from a previous round."
            ],
            "type": "u64"
          },
          {
            "name": "targetTraitCount",
            "docs": [
              "Number of meaningful low bits in the decrypted bitmask (== the round's",
              "`target_trait_count` at request time). Public convenience; bits `>= count` are 0."
            ],
            "type": "u8"
          },
          {
            "name": "ready",
            "docs": [
              "`false` until `private_hint_callback` writes a fresh sealed result; reset to `false`",
              "by every new `queue_private_hint`. Distinguishes \"no hint yet\" from \"hint ready\"."
            ],
            "type": "bool"
          },
          {
            "name": "encryptionKey",
            "docs": [
              "x25519 encryption key from the sealed output (`SharedEncryptedStruct::encryption_key`);",
              "the client combines it with its own private key to derive the decryption shared secret."
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
              "Sealing nonce (little-endian u128) for `ciphertext`."
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "ciphertext",
            "docs": [
              "The sealed 1-byte bitmask (`Enc<Shared, u8>` = 1 scalar * 32 bytes). Meaningless until",
              "`ready == true`."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "computedAt",
            "docs": [
              "Unix timestamp the latest hint was computed (0 until the first callback lands)."
            ],
            "type": "i64"
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
      "name": "leaderChoice",
      "docs": [
        "The computation chosen by a node to be executed when the node is leader."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offset",
            "type": "u64"
          },
          {
            "name": "slotIdx",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "leaderInfo",
      "docs": [
        "The information about a node."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "count",
            "type": "u64"
          },
          {
            "name": "lastCounterPlusOne",
            "type": "u64"
          },
          {
            "name": "choice",
            "type": {
              "defined": {
                "name": "leaderChoice"
              }
            }
          }
        ]
      }
    },
    {
      "name": "leaderSelector",
      "docs": [
        "To select a Leader.",
        "Uses the greatest divisors method: https://en.wikipedia.org/wiki/D%27Hondt_method"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "stakingEpoch",
            "type": {
              "defined": {
                "name": "epoch"
              }
            }
          },
          {
            "name": "info",
            "type": {
              "vec": {
                "defined": {
                  "name": "leaderInfo"
                }
              }
            }
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
          },
          {
            "name": "currentEpochRecoveryRewards",
            "type": "u64"
          },
          {
            "name": "recoveryRewardsEpoch",
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
        "The offset is to derive the Node Account."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offset",
            "type": "u32"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
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
      "name": "privateHintOutput",
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
                "name": "sharedEncryptedStruct",
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
      "name": "revealTop3V3Output",
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
                "name": "revealTop3V3OutputStruct0"
              }
            }
          }
        ]
      }
    },
    {
      "name": "revealTop3V3OutputStruct0",
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
      "name": "revealTop3V3Result",
      "docs": [
        "Result record for a `reveal_top3_v3` computation. Used BOTH by the standalone",
        "differential-test path (one per round, seeded `[TOP3_V3_SEED, round]`) and, crucially, by",
        "the BRACKET: every shard/semifinal/final reveal lands its raw output in one of these,",
        "seeded `[SHARD_RESULT_SEED, round, shard_index]`.",
        "",
        "WHY A SEPARATE ACCOUNT rather than writing `CompetitionRound`. The v3 callback deliberately",
        "does NOT touch `top1/top2/top3` or `scoring_revealed`. For the bracket that is essential —",
        "a shard reveal ranks only its own slice, so writing the round's winners from it would be",
        "wrong; `apply_bracket_result` is what finally writes the round, once, from the final reveal."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "docs": [
              "The round this result belongs to (also the PDA seed)."
            ],
            "type": "pubkey"
          },
          {
            "name": "ready",
            "docs": [
              "`false` until `reveal_top3_v3_callback` lands; reset by every new queue."
            ],
            "type": "bool"
          },
          {
            "name": "slot1",
            "docs": [
              "Winning SLOT indices, exactly as revealed by the circuit."
            ],
            "type": "u16"
          },
          {
            "name": "slot2",
            "type": "u16"
          },
          {
            "name": "slot3",
            "type": "u16"
          },
          {
            "name": "score1",
            "docs": [
              "The three revealed scores, in rank order."
            ],
            "type": "u8"
          },
          {
            "name": "score2",
            "type": "u8"
          },
          {
            "name": "score3",
            "type": "u8"
          },
          {
            "name": "errorCode",
            "docs": [
              "Failure code (0 = none) if the computation aborted."
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump."
            ],
            "type": "u8"
          },
          {
            "name": "generation",
            "docs": [
              "The `generation` of the bracket/tier1 state this result was queued under, stamped at",
              "queue time and NEVER touched by the callback. `collect_*`/`apply` require it to equal",
              "the state's CURRENT generation, so a result computed under an earlier partition (before",
              "an `init_bracket`/`init_tier1_bracket` re-init) can no longer be reused to place a",
              "winner that was never actually ranked against its real shard-mates. (APPENDED field —",
              "old finalized result accounts are never re-read, so this needs no migration.)"
            ],
            "type": "u32"
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
      "name": "scoreEntryV2Output",
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
      "name": "sharedEncryptedStruct",
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
            "name": "encryptionKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
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
      "name": "tier1State",
      "docs": [
        "Tier-1 tracker for a round too large for one tier of shards. PDA: `[TIER1_SEED, round]`.",
        "ADDITIVE — this account simply does not exist for rounds at or under",
        "`SINGLE_TIER_CAPACITY`, and its ABSENCE is what selects the original single-tier path.",
        "`BracketState` is NOT modified: in two-tier mode its existing `shard_*` fields describe",
        "the SEMIFINAL tier, which has exactly the shape it already models.",
        "",
        "ZERO-COPY, and it has to be. At 2,246 bytes a plain `Account<Tier1State>` deserializes",
        "onto the 4 KB BPF stack and aborts the program before the handler runs (measured on",
        "devnet: \"Access violation ... at address 0x0\" after 15,259 CU). `AccountLoader` maps the",
        "account data in place, so size stops mattering for the stack.",
        "",
        "POD LAYOUT RULES this struct obeys, both enforced by bytemuck's derive at compile time:",
        "* no `bool` — `promoted` is a `u8` (0/1), because `bool` is not `Pod`;",
        "* NO IMPLICIT PADDING — every field is align-1 (`Pubkey` is `[u8; 32]`, the rest are",
        "`u8`/`[u8; N]`), so the struct is align-1 and no padding byte can exist regardless",
        "of field order. That is also why `shards_collected` became a `[u8; N]` flag array",
        "instead of a `u32` bitmask: a `u32` would force 4-byte alignment and introduce",
        "trailing padding, which the safe `Pod` derive rejects."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "round",
            "docs": [
              "The round this belongs to (also the PDA seed)."
            ],
            "type": "pubkey"
          },
          {
            "name": "shardBounds",
            "docs": [
              "First entry pubkey of each tier-1 shard, ascending — the partition boundaries."
            ],
            "type": {
              "array": [
                "pubkey",
                17
              ]
            }
          },
          {
            "name": "winners",
            "docs": [
              "Tier-1 winners, kept in ASCENDING PUBKEY ORDER by insertion at collect time.",
              "",
              "Sorting as we go is what lets the semifinal partition be derived and verified BY",
              "INDEX (`winners[start..end]`) rather than trusting operator-declared boundaries."
            ],
            "type": {
              "array": [
                "pubkey",
                51
              ]
            }
          },
          {
            "name": "shardSizes",
            "docs": [
              "Entries per tier-1 shard; only the first `shard_count` slots are meaningful."
            ],
            "type": {
              "array": [
                "u8",
                17
              ]
            }
          },
          {
            "name": "shardDone",
            "docs": [
              "`1` once shard `k`'s winners have been collected. A flag array rather than a bitmask",
              "so the struct stays align-1 (see the Pod rules above); it also removes the 8-shard",
              "ceiling a `u8` mask would have imposed."
            ],
            "type": {
              "array": [
                "u8",
                17
              ]
            }
          },
          {
            "name": "shardCount",
            "docs": [
              "Number of tier-1 shards (1..=`MAX_TIER1_SHARDS`)."
            ],
            "type": "u8"
          },
          {
            "name": "winnerCount",
            "docs": [
              "How many slots of `winners` are filled. NOT necessarily `3 * shard_count`: a shard",
              "smaller than `SHARD_WINNERS` contributes fewer."
            ],
            "type": "u8"
          },
          {
            "name": "promoted",
            "docs": [
              "`1` once `promote_tier1` has written the semifinal partition to `BracketState`."
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
            "name": "generation",
            "docs": [
              "Re-init discriminator, as little-endian `u32` bytes (a `[u8; 4]`, NOT a `u32`, so the",
              "struct stays align-1 for zero-copy). Set at `init_tier1_bracket` to the low 32 bits of",
              "the Clock slot; every tier-1 shard `RevealTop3V3Result` is stamped with it, and",
              "`collect_tier1_winners` rejects a result whose generation != this. A monotonic counter",
              "would NOT work here: `close_tier1_bracket` destroys this account and `init_tier1_bracket`",
              "(`init`, not `init_if_needed`) recreates it zeroed, resetting a counter. The Clock slot",
              "sidesteps that — the exploit needs a READY (MPC-complete) stale result, which is always",
              "many slots after the original init, so a re-init's slot is strictly greater and the",
              "stamps can never collide. (APPENDED; +4 bytes — see the size assertion below.)"
            ],
            "type": {
              "array": [
                "u8",
                4
              ]
            }
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
