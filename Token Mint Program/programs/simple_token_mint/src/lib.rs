use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

declare_id!("8D8VHHS4Ce9Qj7iarFL5NJ3Pm413EFSU8umEjQVbkvoR");

#[program]
pub mod spl_token_mint_and_metadata {
    use super::*;

    pub fn create_token_mint(
        ctx: Context<CreateTokenMint>,
        metadata: TokenMintMetadata,
    ) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[b"authority", &[ctx.bumps.authority]]];

        let token_data = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.authority.to_account_info(),
                payer: ctx.accounts.payer.to_account_info(),
                update_authority: ctx.accounts.authority.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer_seeds,
        );

        create_metadata_accounts_v3(metadata_ctx, token_data, false, true, None)?;
        Ok(())
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[b"authority", &[ctx.bumps.authority]]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );
        mint_to(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(params: TokenMintMetadata)]
pub struct CreateTokenMint<'info> {
    /// CHECK: PDA derived from [b"metadata", metadata_program_id, mint]
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [b"mint"],
        bump,
        mint::decimals = params.decimals,
        mint::authority = authority.key(),
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA that controls the mint
    #[account(
        seeds = [b"authority"],
        bump,
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"mint"],
        bump,
        mint::authority = authority.key(),
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK
    #[account(
    mut,
    seeds = [b"authority"],
    bump
    )]
    pub authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = destination_owner,
    )]
    pub destination: Account<'info, TokenAccount>,

    /// CHECK: we use this to validate token owner
    pub destination_owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct TokenMintMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}
