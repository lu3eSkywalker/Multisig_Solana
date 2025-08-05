use anchor_lang::prelude::*;
use anchor_lang::system_program;
use solana_program::system_instruction;

declare_id!("AeHNvxxjzZBtBMKj44gtBJiEJa7De3z8NPhLENey9yVR");

const MAX_DATA_LEN: usize = 100;
const MAX_APPROVERS: usize = 10;

impl Transaction {
    pub const LEN: usize = 32 + 4 + MAX_DATA_LEN + 4 + MAX_APPROVERS + 32;
}

#[program]
pub mod simple_multisig {
    use super::*;

    pub fn create_multisig(
        ctx: Context<CreateMultisig>,
        owners: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        require!(
            owners.len() >= threshold as usize,
            ErrorCode::InvalidThreshold
        );
        require!(
            threshold as usize <= owners.len(),
            ErrorCode::InvalidThreshold
        );

        let ms = &mut ctx.accounts.multisig;
        ms.owners = owners;
        ms.threshold = threshold;

        Ok(())
    }

    pub fn create_transaction(
        ctx: Context<CreateTransaction>,
        program_id: Pubkey,
        data: Vec<u8>,
    ) -> Result<()> {
        let tx = &mut ctx.accounts.transaction;
        let ms = &ctx.accounts.multisig;
        require!(ms.owners.contains(ctx.accounts.proposer.key), ErrorCode::Unauthorized);

        tx.program_id = program_id;
        tx.data = data;
        tx.approvals = vec![ctx.accounts.proposer.key()];

        tx.multisig = ctx.accounts.multisig.key();
        tx.executed = false;
        Ok(())
    }

    pub fn approve(ctx: Context<Approve>) -> Result<()> {
        let tx = &mut ctx.accounts.transaction;
        let ms = &ctx.accounts.multisig;

        require!(
            ms.owners.contains(ctx.accounts.approver.key),
            ErrorCode::Unauthorized
        );
        require!(!tx.executed, ErrorCode::AlreadyExecuted);
        if !tx.approvals.contains(ctx.accounts.approver.key) {
            tx.approvals.push(ctx.accounts.approver.key());
        }
        Ok(())
    }

    pub fn execute(ctx: Context<ExecuteTransaction>) -> Result<()> {
        let tx = &mut ctx.accounts.transaction;
        let ms = &ctx.accounts.multisig;

        require!(!tx.executed, ErrorCode::AlreadyExecuted);

        require!(
            tx.approvals.len() >= ms.threshold as usize,
            ErrorCode::NotEnoughApprovals
        );

        // Construct the CPI instruction
        let ix = solana_program::instruction::Instruction {
            program_id: tx.program_id,
            accounts: vec![], // Add any account metas here if needed
            data: tx.data.clone(),
        };

        // Perform the CPI (no signer seeds used for simplicity)
        let account_infos = ctx.remaining_accounts;
        solana_program::program::invoke(&ix, account_infos)?;

        // Mark transaction as executed
        tx.executed = true;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateMultisig<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 * 10 + 2 + 1,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateTransaction<'info> {
    #[account(
        init,
        payer = proposer,
        space = 8 + Transaction::LEN
    )]
    pub transaction: Account<'info, Transaction>,

    #[account()]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Approve<'info> {
    #[account(mut)]
    pub transaction: Account<'info, Transaction>,

    pub multisig: Account<'info, Multisig>,

    #[account(signer)]
    pub approver: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(mut, has_one = multisig)]
    pub transaction: Account<'info, Transaction>,
    pub multisig: Account<'info, Multisig>,
}

#[account]
pub struct Multisig {
    pub owners: Vec<Pubkey>,
    pub threshold: u8,
}

#[account]
pub struct Transaction {
    pub multisig: Pubkey,
    pub program_id: Pubkey,
    pub data: Vec<u8>,
    pub approvals: Vec<Pubkey>,
    pub executed: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Not Enough Signers have signed the transaction")]
    NotEnoughApprovals,

    #[msg("At least one owner required")]
    InvalidOwners,

    #[msg("This transaction was already executed.")]
    AlreadyExecuted,

    #[msg("You are not an authorized signer")]
    Unauthorized,

    #[msg("Threshold must be less than or equal to number of owners")]
    InvalidThreshold,
}