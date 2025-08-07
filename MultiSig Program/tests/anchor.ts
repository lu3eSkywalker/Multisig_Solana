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

  // Generate a new keypair for the multisig account
  const multisigKeypair = web3.Keypair.generate();

  // Generate a new transasction keypair for the multisig account
  const transactionKeypair = web3.Keypair.generate();

  it("creates a multisig", async () => {

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

  it("creates a transaction", async () => {

    const instructionData = Buffer.from([
      0x3b, 0x84, 0x18, 0xf6, 0x7a, 0x27, 0x08, 0xf3,
      0x00, 0xf2, 0x05, 0x2a, 0x01, 0x00, 0x00, 0x00
    ]);

    const programId = new web3.PublicKey("8D8VHHS4Ce9Qj7iarFL5NJ3Pm413EFSU8umEjQVbkvoR");


    const txHash = await program.methods
      .createTransaction(programId, instructionData)
      .accounts({
        transaction: transactionKeypair.publicKey,
        multisig: multisigKeypair.publicKey,
        proposer: program.provider.publicKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([transactionKeypair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  })

  it("multisig owner 1 approves the transaction", async () => {

    const user1PrivateKey = ""
    const privateKeySeed = bs58.decode(user1PrivateKey);

    const userKeyPair = web3.Keypair.fromSecretKey(privateKeySeed);

    const txHash = await program.methods
      .approve()
      .accounts({
        transaction: transactionKeypair.publicKey,
        multisig: multisigKeypair.publicKey,
        approver: userKeyPair.publicKey,
      })
      .signers([userKeyPair])
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("multisig owner 2 approves the transaction", async () => {

    const txHash = await program.methods
      .approve()
      .accounts({
        transaction: transactionKeypair.publicKey,
        multisig: multisigKeypair.publicKey,
        approver: program.provider.publicKey,
      })
      .rpc();

    console.log(`use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("executes the transaction", async () => {

    const mint = new web3.PublicKey("BPWcB5xJkWyJ7B9qLNNbt2vRjibbz6WCJaX2SYXtqg4U");
    const authority = new web3.PublicKey("J91ahokEJwoJ1RQynJy3bPVLrAx9WwZwdsBskmVyaHVA");

    const userAddress = new web3.PublicKey("7eacdg5tZYPPqNdhi9PHvP5TUCEt9RjgUyoJL1a6L8JA");

    const destination = await getAssociatedTokenAddress(
      mint,
      userAddress
    );

    const destinationOwner = new web3.PublicKey("7eacdg5tZYPPqNdhi9PHvP5TUCEt9RjgUyoJL1a6L8JA");

    // Check if ATA is initialized or not
    const ataAccountInfo = await program.provider.connection.getAccountInfo(destination);

    if (ataAccountInfo && ataAccountInfo.data.length > 0) {
      console.log("ATA is already initialized");
    } else {
      console.log("initializing ata")

      // Create associated token account if it doesn't exist
      const ataIx = createAssociatedTokenAccountInstruction(
        program.provider.publicKey, // payer
        destination,                // ata to be created
        userAddress,                  // token account owner
        mint                        // mint
      );

      const tx = new web3.Transaction().add(ataIx);

      await program.provider.sendAndConfirm(tx);
    }

    const ix = await program.methods
      .execute()
      .accounts({
        transaction: transactionKeypair.publicKey,
        multisig: multisigKeypair.publicKey,
      })
      .remainingAccounts([
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: destinationOwner, isSigner: false, isWritable: false },
        { pubkey: program.provider.publicKey, isSigner: true, isWritable: true },
        { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
        { pubkey: anchor.utils.token.ASSOCIATED_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: new web3.PublicKey("8D8VHHS4Ce9Qj7iarFL5NJ3Pm413EFSU8umEjQVbkvoR"), isSigner: false, isWritable: false }
      ])
      .instruction();

    const tx = new web3.Transaction().add(ix);

    const txHash = await program.provider.sendAndConfirm(tx, []);
    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
  });
});