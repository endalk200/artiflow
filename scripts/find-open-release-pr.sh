#!/usr/bin/env bash

set -euo pipefail

branch="${1:?Pass the release branch name}"
base="${2:?Pass the base branch name}"
owner="${3:?Pass the head repository owner}"
repository="${4:?Pass the head repository name}"
pull_requests="$(
	gh pr list \
		--base "${base}" \
		--head "${branch}" \
		--state open \
		--json baseRefName,headRefName,headRepository,headRepositoryOwner,number
)"
number="$(
	jq --raw-output \
		--arg base "${base}" \
		--arg branch "${branch}" \
		--arg owner "${owner}" \
		--arg repository "${repository}" \
		'map(select(
			.baseRefName == $base
			and .headRefName == $branch
			and .headRepositoryOwner.login == $owner
			and .headRepository.name == $repository
		)) | if length == 1 then .[0].number else empty end' \
		<<< "${pull_requests}"
)"

if [[ -n "${number}" && ! "${number}" =~ ^[0-9]+$ ]]; then
	echo "GitHub returned an invalid pull request number for ${branch}: ${number}." >&2
	exit 1
fi

printf '%s\n' "${number}"
