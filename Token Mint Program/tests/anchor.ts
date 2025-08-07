import * as anchor from "@coral-xyz/anchor";
import BN, { min } from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, createAssociatedTokenAccountInstruction, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
// import type { StakeWithTokenReward } from "../target/types/stake_with_token_reward";
import { SplTokenMintAndMetadata } from "../target/types/spl_token_mint_and_metadata";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .SplTokenMintAndMetadata as anchor.Program<SplTokenMintAndMetadata>;

  const METADATA_SEED = "metadata";
  const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

  const payer = program.provider.wallet.publicKey;
  // Mint PDA
  const [mint] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
  );

  const [authority, bump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("authority")],
    program.programId
  );
  // Metadata PDA
  const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(METADATA_SEED),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  console.log("This is the authority address: ", authority.toBase58());
  console.log("This is the authority bump: ", bump.toString());
  console.log("This is the mint address: ", mint.toBase58());

  it("creates a Token Mint", async () => {
    console.log("This is the metadata address: ", metadataAddress.toBase58());

    console.log("This is the mint address: ", mint.toBase58());

    const metadata = {
      name: "Bonk Token",
      symbol: "BONK",
      uri: "https://www.jsonkeeper.com/b/0863",
      decimals: 9,
    };

    const txHash = await program.methods
      .createTokenMint(metadata)
      .accounts({
        metadata: metadataAddress,
        mint: mint,
        authority: authority,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
  });

  it("mints token to a program owner", async () => {
    const tokens_to_mint = new BN(1000_000_000_000);

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: program.provider.publicKey
    });

    console.log("This is the fukcing user token address(destination): ", destination.toString());

    const txHash = await program.methods
      .mintTokens(tokens_to_mint)
      .accounts({
        mint,
        authority,
        destination,
        destinationOwner: program.provider.publicKey,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("mints token to a user", async () => {
    const tokens_to_mint = new BN(100_000_000_000);

    const userAddress = new web3.PublicKey("HVw1Z2KFYfKjdL2UThi5RGBvSUpsF4zdsPrucV8TggQm");

    const destination = await getAssociatedTokenAddress(
      mint,
      userAddress
    );

    console.log("This is the userATA: ", destination.toBase58());

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

    const txHash = await program.methods
      .mintTokens(tokens_to_mint)
      .accounts({
        mint,
        authority,
        destination,
        destinationOwner: userAddress,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // // Confirm transaction
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("getting the anchor instruction", async () => {

    const destination = await anchor.utils.token.associatedAddress({
      mint: mint,
      owner: program.provider.publicKey
    });

    // Encode instruction data using Anchor helper
    const ix = await program.methods
      .mintTokens(new anchor.BN(5_000_000_000))
      .accounts({
        mint,
        authority,
        destination,
        destinationOwner: program.provider.publicKey,
        payer: program.provider.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .instruction();

    console.log("This is the data: ", ix.data);
  })
});