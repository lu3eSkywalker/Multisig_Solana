import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress, transfer } from "@solana/spl-token";
import { SimpleMultisig } from "../target/deploy/SimpleMultisig";
import { BN } from "bn.js";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SimpleMultisig as anchor.Program<SimpleMultisig>;

  it("creates a multisig", async () => {
    // Generate a new keypair for the multisig account
    const multisigKeypair = web3.Keypair.generate();

    const user1PublicKey = new web3.PublicKey("HVw1Z2KFYfKjdL2UThi5RGBvSUpsF4zdsPrucV8TggQm");
    const user2PublicKey = new web3.PublicKey("7eacdg5tZYPPqNdhi9PHvP5TUCEt9RjgUyoJL1a6L8JA");

    const owners = [
      program.provider.publicKey,
      user1PublicKey,
      user2PublicKey
    ];

    const threshold = 2;

    const LAMPORTS_PER_SOL = 1_000_000_000;

    const transferTx = new web3.Transaction().add(
      web3.SystemProgram.transfer({
        fromPubkey: program.provider.publicKey,
        toPubkey: multisigKeypair.publicKey,
        lamports: LAMPORTS_PER_SOL,
      })
    );

    await program.provider.sendAndConfirm(transferTx);

    // Initialize the multisig account
    const txHash = await program.methods
    .createMultisig(owners, threshold)
    .accounts({
      multisig: multisigKeypair.publicKey,
      payer: program.provider.publicKey,
      systemProgram: web3.SystemProgram.programId,
    })
    .signers([multisigKeypair])
    .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);

    const multisigAccount = await program.provider.connection.getAccountInfo(multisigKeypair.publicKey);
    console.log("Multisig account created with data: ", multisigAccount);
  });
});