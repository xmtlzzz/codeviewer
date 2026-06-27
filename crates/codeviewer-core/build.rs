fn main() {
    #[cfg(target_os = "windows")]
    {
        // libgit2-sys requires advapi32 for CryptoAPI, registry, and SID functions.
        // On some Windows toolchains (lld-link), this library is not auto-linked.
        println!("cargo:rustc-link-lib=dylib=advapi32");
    }
}
