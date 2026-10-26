use std::error::Error;
use std::fs;
use std::path::PathBuf;

use bitcoinkernel::prelude::*;
use bitcoinkernel::{
    verify, Block, BlockTreeEntry, BlockValidationStateRef, ChainType, ChainstateManager, Context,
    ContextBuilder, KernelError, Log, LogCategory, LogLevel, Logger, PrecomputedTransactionData,
    ProcessBlockResult, Transaction, TxOut, ValidationMode, VERIFY_ALL_PRE_TAPROOT,
};

pub type Result<T> = std::result::Result<T, Box<dyn Error>>;

pub const BLOCKS_HEX: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/data/blocks.hex");

pub fn data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("kernel-data")
}

struct StdoutLog;

impl Log for StdoutLog {
    fn log(&self, message: &str) {
        print!("kernel | {message}");
    }
}

pub fn start_logger() -> Result<Logger> {
    let logger = Logger::new(StdoutLog)?;
    logger.set_level_category(LogCategory::Validation, LogLevel::Debug);
    logger.enable_category(LogCategory::BlockStorage);
    Ok(logger)
}

pub fn build_context() -> Result<Context> {
    let context = ContextBuilder::new()
        .chain_type(ChainType::Mainnet)
        .notifications(|n| {
            n.register_block_tip(|state, hash, progress| {
                println!("tip {hash} {state:?} {:.4}%", progress * 100.0);
            });
            n.register_progress(|title, pct, _| println!("{title} {pct}%"));
            n.register_fatal_error(|msg| {
                eprintln!("FATAL: {msg}");
                std::process::exit(1);
            });
        })
        .validation(|v| {
            v.register_block_checked(|block: Block, state: BlockValidationStateRef<'_>| {
                if state.mode() != ValidationMode::Valid {
                    eprintln!("✗ {} {:?}", block.hash(), state.result());
                }
            });
            v.register_block_connected(|block: Block, entry: BlockTreeEntry<'_>| {
                println!("+ #{} {}", entry.height(), block.hash());
            });
            v.register_block_disconnected(|block: Block, entry: BlockTreeEntry<'_>| {
                println!("- #{} {}", entry.height(), block.hash());
            });
        })
        .build()?;
    Ok(context)
}

pub fn open_chainstate(context: &Context) -> Result<ChainstateManager> {
    let data = data_dir();
    let blocks = data.join("blocks");
    let chainman = ChainstateManager::builder(
        context,
        data.to_str().ok_or("non-utf8 data dir")?,
        blocks.to_str().ok_or("non-utf8 blocks dir")?,
    )?
    .worker_threads(4)
    .wipe_db(false, false)?
    .build()?;
    chainman.import_blocks()?;
    Ok(chainman)
}

pub fn decode_hex(hex: &str) -> Result<Vec<u8>> {
    let hex = hex.trim();
    if hex.len() % 2 != 0 {
        return Err("odd-length hex".into());
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| Ok(u8::from_str_radix(&hex[i..i + 2], 16)?))
        .collect()
}

pub fn load_blocks() -> Result<Vec<Vec<u8>>> {
    fs::read_to_string(BLOCKS_HEX)?
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(decode_hex)
        .collect()
}

pub fn exercise_1() -> Result<()> {
    let _logger = start_logger()?;
    let context = build_context()?;
    let chainman = open_chainstate(&context)?;

    let tip = chainman.active_chain().tip();
    println!("tip height: {}", tip.height());
    Ok(())
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct ProcessCounts {
    pub new: usize,
    pub duplicate: usize,
    pub rejected: usize,
}

pub fn process_all(chainman: &ChainstateManager, raw_blocks: &[Vec<u8>]) -> Result<ProcessCounts> {
    let mut counts = ProcessCounts::default();
    for raw in raw_blocks {
        let block = Block::new(raw)?;
        match chainman.process_block(&block) {
            ProcessBlockResult::NewBlock => counts.new += 1,
            ProcessBlockResult::Duplicate => counts.duplicate += 1,
            ProcessBlockResult::Rejected => counts.rejected += 1,
        }
    }
    Ok(counts)
}

pub fn exercise_2() -> Result<()> {
    let _ = fs::remove_dir_all(data_dir());

    let _logger = start_logger()?;
    let context = build_context()?;
    let chainman = open_chainstate(&context)?;

    let raw_blocks = load_blocks()?;
    let counts = process_all(&chainman, &raw_blocks)?;
    println!(
        "new: {}  duplicate: {}  rejected: {}",
        counts.new, counts.duplicate, counts.rejected
    );

    let tip = chainman.active_chain().tip();
    println!("tip: #{} {}", tip.height(), tip.block_hash());
    Ok(())
}

pub fn exercise_2_bonus() -> Result<()> {
    let _ = fs::remove_dir_all(data_dir());

    let _logger = start_logger()?;
    let context = build_context()?;
    let chainman = open_chainstate(&context)?;

    let mut raw_blocks = load_blocks()?;
    raw_blocks.truncate(100);
    let last = raw_blocks.last_mut().ok_or("no blocks")?;
    let i = last.len() - 10;
    last[i] ^= 0x01;

    let counts = process_all(&chainman, &raw_blocks)?;
    println!(
        "new: {}  duplicate: {}  rejected: {}",
        counts.new, counts.duplicate, counts.rejected
    );

    let tip = chainman.active_chain().tip();
    println!("tip: #{} {}", tip.height(), tip.block_hash());
    drop(chainman);
    let _ = fs::remove_dir_all(data_dir());
    Ok(())
}

pub fn exercise_3() -> Result<()> {
    let _logger = start_logger()?;
    let context = build_context()?;
    let chainman = open_chainstate(&context)?;
    let chain = chainman.active_chain();
    println!("height {}", chain.height());

    let mut issued: i64 = 0;
    let mut first_spend = None;
    for entry in chain.iter() {
        let block = chainman.read_block_data(&entry)?;
        println!(
            "{:>4}  {}  {} tx",
            entry.height(),
            entry.block_hash(),
            block.transaction_count()
        );

        let coinbase = block.transaction(0)?;
        issued += coinbase.outputs().map(|out| out.value()).sum::<i64>();

        if first_spend.is_none() && block.transaction_count() > 1 {
            first_spend = Some(entry);
        }
    }
    println!("total issued: {} BTC", issued / 100_000_000);

    let entry = first_spend.ok_or("no block with a non-coinbase transaction")?;
    println!("first non-coinbase transaction in block {}", entry.height());

    let block = chainman.read_block_data(&entry)?;
    let spent = chainman.read_spent_outputs(&entry)?;
    for (tx, coins) in block.transactions().skip(1).zip(spent.iter()) {
        for (input, coin) in tx.inputs().zip(coins.coins()) {
            println!(
                "{} spends {}:{} worth {} sat created at height {}",
                tx.txid(),
                input.outpoint().txid(),
                input.outpoint().index(),
                coin.output().value(),
                coin.confirmation_height(),
            );
        }
    }

    let tip = chain.tip();
    let parent = tip.prev().ok_or("tip has no parent")?;
    let h100 = tip.ancestor(100).ok_or("no ancestor at 100")?;
    println!("tip parent #{} {}", parent.height(), parent.block_hash());
    println!("ancestor #{} {}", h100.height(), h100.block_hash());

    if let Some(best) = chainman.best_entry() {
        println!("best header #{} {}", best.height(), best.block_hash());
    }
    Ok(())
}

pub fn verify_input(
    tx: &Transaction,
    spent: &[TxOut],
    input_index: usize,
) -> std::result::Result<(), KernelError> {
    let txdata = PrecomputedTransactionData::new(tx, spent)?;
    verify(
        &spent[input_index].script_pubkey(),
        Some(spent[input_index].value()),
        tx,
        input_index,
        Some(VERIFY_ALL_PRE_TAPROOT),
        &txdata,
    )
}

pub fn first_output_value_offset(raw_tx: &[u8]) -> Result<usize> {
    let mut pos = 4;
    if raw_tx.get(pos) != Some(&1) {
        return Err("expected exactly one input".into());
    }
    pos += 1 + 36;
    let script_len = *raw_tx.get(pos).ok_or("truncated tx")? as usize;
    if script_len >= 0xfd {
        return Err("unexpected scriptSig length".into());
    }
    pos += 1 + script_len + 4;
    pos += 1;
    if pos + 8 > raw_tx.len() {
        return Err("truncated tx".into());
    }
    Ok(pos)
}

pub fn exercise_4() -> Result<()> {
    let _logger = start_logger()?;
    let context = build_context()?;
    let chainman = open_chainstate(&context)?;
    let chain = chainman.active_chain();

    let entry = chain
        .at_height(170)
        .ok_or("block 170 not in chain, run exercise 2 first")?;
    let block = chainman.read_block_data(&entry)?;
    let spent = chainman.read_spent_outputs(&entry)?;

    let tx = block.transaction(1)?.to_owned();
    let coins = spent.transaction_spent_outputs(0)?;
    let spent_outputs: Vec<TxOut> = coins.coins().map(|c| c.output().to_owned()).collect();

    println!("tx {}", tx.txid());
    println!("original: {:?}", verify_input(&tx, &spent_outputs, 0));

    let mut raw = tx.consensus_encode()?;
    let offset = first_output_value_offset(&raw)?;
    let value = i64::from_le_bytes(raw[offset..offset + 8].try_into()?);
    raw[offset..offset + 8].copy_from_slice(&(value + 1).to_le_bytes());
    let tampered = Transaction::new(&raw)?;

    println!("tampered: {:?}", verify_input(&tampered, &spent_outputs, 0));
    Ok(())
}
