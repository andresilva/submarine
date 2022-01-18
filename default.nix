{ pkgs ? import <nixpkgs> { } }:
pkgs.mkYarnPackage {
  name = "submarine";
  src = ./.;

  packageJSON = ./package.json;
  yarnLock = ./yarn.lock;
  yarnNix = ./yarn.nix;

  buildPhase = ''
    yarn build
  '';

  postInstall = ''
    chmod +x $out/bin/$name
  '';
}
