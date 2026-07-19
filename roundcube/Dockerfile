# Fase 1: imagen de Roundcube + plugins/skin propios de MOVI (esqueleto).
#
# Verificar el tag contra la última versión estable soportada al momento del
# despliegue real: https://hub.docker.com/r/roundcube/roundcubemail/tags
FROM roundcube/roundcubemail:1.6.9-apache

# Plugins propios — en esta fase son solo esqueleto (ver comentarios en cada
# uno), la lógica real llega en fases posteriores.
COPY plugins/movi_auth /var/www/html/plugins/movi_auth
COPY plugins/movi_signatures /var/www/html/plugins/movi_signatures
COPY plugins/movi_contacts /var/www/html/plugins/movi_contacts

# Skin propio (hereda de "elastic", solo sobreescribe lo necesario para
# vivir embebido dentro del layout de MOVI).
COPY skins/movi /var/www/html/skins/movi

# Hook oficial de la imagen: corre DESPUÉS de que el entrypoint genera
# config.inc.php a partir de las variables ROUNDCUBEMAIL_*, así que puede
# agregar configuración que esas variables no cubren sin que se sobreescriba.
# Confirmar esta ruta contra la versión de imagen real (docker-library/roundcube
# la documenta como docker-entrypoint-hooks.d/before-starting/*.sh).
COPY docker-entrypoint-hooks.d/before-starting/10-movi-config.sh /docker-entrypoint-hooks.d/before-starting/10-movi-config.sh
RUN chmod +x /docker-entrypoint-hooks.d/before-starting/10-movi-config.sh
