# Base image
FROM node AS node

# Update and upgrade
RUN \
    apt-get update && \
    apt-get install -y php unzip

WORKDIR /app

COPY ./ /app/
COPY package.json yarn.lock ./

RUN yarn global add gulp-cli
RUN yarn add gulp@4 -D
RUN gulp build

# Base image
FROM php:apache

# Project variables
ENV PROJECT_NAME jonas-thelemann.de
ENV PROJECT_MODS headers macro rewrite ssl

# Apache & PHP variables
ENV APACHE_DIR /var/www/$PROJECT_NAME/
ENV APACHE_CONFDIR /etc/apache2/
ENV PHP_INI_DIR /usr/local/etc/php/

# Enable extensions
RUN apt-get update \
    && apt-get install -y \
    libpq-dev \
    && docker-php-ext-install \
    pdo_pgsql

# Create Apache directory and copy the files
RUN mkdir -p $APACHE_DIR
COPY --from=node /app/dist/jonas-thelemann.de "$APACHE_DIR/"

# Copy Apache and PHP config files
COPY docker/jonas-thelemann.de/certs/* "/etc/ssl/certs/"
COPY docker/jonas-thelemann.de/apache/conf/* "$APACHE_CONFDIR/conf-available/"
COPY docker/jonas-thelemann.de/apache/site/* "$APACHE_CONFDIR/sites-available/"
COPY docker/jonas-thelemann.de/php/* "$PHP_INI_DIR/"

# Enable mods, config and site
RUN a2enmod $PROJECT_MODS
RUN a2enconf $PROJECT_NAME
RUN a2dissite *
RUN a2ensite $PROJECT_NAME

# Update workdir to server files' location
WORKDIR $APACHE_DIR/server
