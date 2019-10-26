# Constants.
##
CONTAINER_REDMINE=redmine-appserver
CONTAINER_MYSQL=redmine-mysql
CONTAINER_MAILHOG=redmine-mailhog

SERVICE_REDMINE=redmine
SERVICE_MYSQL=mysql
SERVICE_MAILHOG=mailhog

# MySQL connection params.
MYSQL_DATABASE=redmine
MYSQL_USERNAME=redmine
MYSQL_PASSWORD=redmine

PLUGINS_DIRECTORY=data/plugins

# Variables.
##
SERVICE=$(SERVICE_REDMINE)

ps:
	docker-compose ps

build: data/plugins
	if [ ! -f .env ]; then cp .env.example .env; fi
	docker-compose up -d

rebuild: remove build

debug/build:
	docker run -t -i --rm `docker images -q | head -n 1` /bin/bash

data/plugins: data/plugins/toggl2redmine

data/plugins/toggl2redmine:
	git -C $(PLUGINS_DIRECTORY) clone --branch=3.x git@github.com:jigarius/toggl2redmine.git

remove:
	docker-compose down

nuke:
	docker-compose down -v

start:
	docker-compose start

stop:
	docker-compose stop

restart:
	docker-compose restart

bash:
	docker-compose exec $(SERVICE) bash

mysql:
	docker-compose exec $(SERVICE_MYSQL) mysql -u$(MYSQL_USERNAME) -p$(MYSQL_PASSWORD) $(MYSQL_DATABASE)

rails/console:
	docker-compose exec $(SERVICE_REDMINE) rails console

redmine/restart:
	docker exec -t $(CONTAINER_REDMINE) touch tmp/restart.txt
