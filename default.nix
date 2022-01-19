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

  postPatch = ''
    sed -i '1i#!/usr/bin/env node' src/app.ts
  '';

  postInstall = ''
    chmod +x $out/bin/$name
  '';
}
