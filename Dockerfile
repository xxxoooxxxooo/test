# Simple Dockerfile to run the site with PHP (Apache)
FROM php:8.2-apache

# Enable Apache modules and allow .htaccess overrides
RUN a2enmod rewrite \
  && sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

ENV ENABLED_VIDEO_PROVIDERS=mock \
    APACHE_DOCUMENT_ROOT=/var/www/html

# Configure Apache DocumentRoot
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

WORKDIR /var/www/html

# Copy app files
COPY . /var/www/html/

# Persist data directory
VOLUME ["/var/www/html/data"]

EXPOSE 80

# Apache will be the entrypoint
CMD ["apache2-foreground"]
