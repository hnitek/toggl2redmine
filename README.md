# Toggl 2 Redmine: Docker

Deploys Redmine in a dockerized environment and installs Toggl 2 Redmine.

## Usage

```bash
  # Clone the right deploy branch.
  git clone --branch 3.x-deploy git@github.com:jigarius/toggl2redmine.git t2r-deploy
  # Switch into the deploy directory.
  cd t2r-deploy
  # Build docker envioronment.
  make build
```

## Commands

Here are some other day-to-day commands.

  * `make start` starts containers.

  * `make stop` stops containers.

  * `make bash` launches a shell.

  * `make rails/console` launches rails console.

  * `make mysql` launches MySQL CLI.

  * `make redmine/restart` schedules a Redmine restart.

Refer to the `Makefile` for more info.
