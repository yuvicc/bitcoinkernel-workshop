fn main() -> kernel_workshop::Result<()> {
    match std::env::args().nth(1).as_deref() {
        Some("show-tip") => kernel_workshop::show_tip(),
        Some("validate") => kernel_workshop::validate_bundled_blocks(),
        Some("mutated") => kernel_workshop::reject_mutated_block(),
        Some("explore") => kernel_workshop::explore_chain(),
        Some("verify") => kernel_workshop::verify_satoshi_signature(),
        _ => Err("usage: cargo run -- <show-tip|validate|mutated|explore|verify>".into()),
    }
}
