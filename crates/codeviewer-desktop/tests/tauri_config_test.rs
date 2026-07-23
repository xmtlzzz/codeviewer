use serde_json::Value;

fn tauri_config() -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tauri.conf.json");
    let content = std::fs::read_to_string(path).unwrap();
    serde_json::from_str(&content).unwrap()
}

#[test]
fn build_commands_are_portable() {
    let config = tauri_config();
    let build = config["build"].as_object().unwrap();
    let before_dev = build["beforeDevCommand"].as_str().unwrap();
    let before_build = build["beforeBuildCommand"].as_str().unwrap();

    for command in [before_dev, before_build] {
        assert!(!command.contains("npm.cmd"));
        assert!(!command.contains(":\\"));
        assert!(command.contains("../../frontend"));
    }
}

#[test]
fn content_security_policy_is_explicit() {
    let config = tauri_config();
    let csp = config["app"]["security"]["csp"].as_str().unwrap();

    assert!(csp.contains("default-src 'self'"));
    assert!(csp.contains("connect-src 'self' https://api.github.com"));
    assert!(!csp.contains("*"));
}
