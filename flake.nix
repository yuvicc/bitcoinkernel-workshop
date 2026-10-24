{
  description = "Bitcoinkernel workshop: slides + rust-bitcoinkernel exercises";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        # Everything needed to build bitcoinkernel-sys (which compiles Bitcoin Core via cmake)
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [ cargo rustc rust-analyzer clippy rustfmt cmake boost pkg-config ];
          LIBCLANG_PATH = "${pkgs.llvmPackages.libclang.lib}/lib";
          shellHook = ''echo "kernel workshop shell: $(rustc --version), $(cmake --version | head -1)"'';
        };

        # `nix run .#slides` serves index.html at http://localhost:8000
        apps.slides = {
          type = "app";
          program = toString (pkgs.writeShellScript "slides" ''
            cd ${self} && exec ${pkgs.python3}/bin/python3 -m http.server ''${PORT:-8000}
          '');
        };
      });
}
