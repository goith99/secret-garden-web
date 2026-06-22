// Stage 6C verification: read REAL on-chain devnet data using the same IDL + PDA seeds the
// frontend uses. Independent of React. Run: node scripts/verify-read.mjs
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import anchorPkg from "@anchor-lang/core";
import { readFileSync } from "fs";

const { AnchorProvider, Program, BN } = anchorPkg;
const idl = JSON.parse(readFileSync(new URL("../src/program/idl/secret_garden.json", import.meta.url)));
const OWNER = new PublicKey("8L9SoH5Kw4DLw32vUQY4H3PMgkRL9mm9MLDT5z2QEbTd");
const PROGRAM_ID = new PublicKey(idl.address);
const te = new TextEncoder();
const u32le = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const u64le = (n) => Uint8Array.from(new BN(n).toArray("le", 8));
const pda = (seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const dummy = Keypair.generate();
const wallet = { publicKey: dummy.publicKey, signTransaction: async (t) => t, signAllTransactions: async (t) => t };
const program = new Program(idl, new AnchorProvider(conn, wallet, { commitment: "confirmed" }));

const config = await program.account.gameConfig.fetchNullable(pda([te.encode("config")]));
const profile = await program.account.playerProfile.fetchNullable(pda([te.encode("profile"), OWNER.toBytes()]));
console.log("GameConfig:", config && { authority: config.authority.toBase58(), paused: config.paused, currentRound: config.currentRound.toString(), starterCount: config.starterCount });
console.log("PlayerProfile:", profile && { starterClaimed: profile.starterClaimed, totalFlowers: profile.totalFlowers, totalCrosses: profile.totalCrosses, nextFlowerIndex: profile.nextFlowerIndex, totalExperiments: profile.totalExperiments });

if (profile) {
  const pdas = Array.from({ length: profile.nextFlowerIndex }, (_, i) => pda([te.encode("flower"), OWNER.toBytes(), u32le(i)]));
  const accs = await program.account.flowerRecord.fetchMultiple(pdas);
  const flowers = accs.map((a, i) => a && { idx: a.flowerIndex, species: a.visualSpeciesId, gen: a.generation, genome: a.genomeStatus, mask: (a.revealedTraitMask >>> 0) }).filter(Boolean);
  console.log(`\nFlowerRecords found: ${flowers.length} / ${profile.nextFlowerIndex} indices`);
  for (const f of flowers) {
    const m = f.mask;
    const classes = f.species === 255 ? { petal: (m & 0xff) % 5, color: ((m >>> 8) & 0xff) % 5, leaf: ((m >>> 16) & 0xff) % 5, stem: ((m >>> 24) & 0xff) % 5 } : null;
    console.log(`  flower#${f.idx} species=${f.species} gen=${f.gen} genomeStatus=${f.genome} mask=${m}${classes ? " classes=" + JSON.stringify(classes) : ""}`);
  }
}

const cr = config ? Number(config.currentRound.toString()) : 0;
const round = cr > 0 ? await program.account.competitionRound.fetchNullable(pda([te.encode("round"), u64le(cr)])) : null;
console.log("\nActiveRound:", round ? { roundId: round.roundId.toString(), status: round.status, participantCount: round.participantCount, targetTraits: Array.from(round.targetTraits).slice(0, round.targetTraitCount), scoringRevealed: round.scoringRevealed } : `none (currentRound=${cr})`);
