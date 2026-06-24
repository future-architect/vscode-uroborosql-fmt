#!/usr/bin/env bash

export CODE_TESTS_PATH="$(pwd)/client/out/test"
export CODE_TESTS_WORKSPACE="$(pwd)/client/multirootFixture/multi.code-workspace"

node "$(pwd)/client/out/test/runMultirootTest"
