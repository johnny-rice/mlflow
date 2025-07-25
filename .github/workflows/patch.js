module.exports = async ({ context, github, core }) => {
  const { owner, repo } = context.repo;
  const { base, number: pull_number } = context.payload.pull_request;
  if (base.ref.match(/^branch-\d+\.\d+$/)) {
    return;
  }

  const pr = await github.rest.pulls.get({
    owner,
    repo,
    pull_number,
  });
  const { body } = pr.data;

  // Skip running this check on CD automation PRs
  if (!body) {
    core.info("Skipping processing because the PR has no body.");
    return;
  }

  const marker = "<!-- patch -->";
  if (body && !body.includes(marker)) {
    return;
  }

  const patchSection = body.split(marker)[1];
  const yesRegex = /- \[( |x)\] yes/gi;
  const yesMatch = yesRegex.exec(patchSection);
  const yes = yesMatch ? yesMatch[1].toLowerCase() === "x" : false;
  const noRegex = /- \[( |x)\] no/gi;
  const noMatch = noRegex.exec(patchSection);
  const no = noMatch ? noMatch[1].toLowerCase() === "x" : false;

  if (yes && no) {
    core.setFailed(
      "Both yes and no are selected. Please select only one in the `Should this PR be included in the next patch release?` section."
    );
    return;
  }

  if (!yes && !no) {
    core.setFailed(
      "Please fill in the `Should this PR be included in the next patch release?` section."
    );
    return;
  }

  if (no) {
    return;
  }

  const releases = await github.rest.repos.listReleases({
    owner,
    repo,
  });
  const latest = releases.data[0];
  const version = latest.tag_name.replace("v", "");
  const [major, minor, micro] = version.replace(/rc\d+$/, "").split(".");
  const nextMicro = version.includes("rc") ? micro : (parseInt(micro) + 1).toString();
  const label = `v${major}.${minor}.${nextMicro}`;
  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: context.payload.pull_request.number,
    labels: [label],
  });
};
