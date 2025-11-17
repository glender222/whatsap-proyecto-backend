-- Script para eliminar las tablas innecesarias del sistema de bots
-- Ejecutar este script ANTES de iniciar el servidor con la nueva estructura

-- 1. Eliminar tablas de palabras clave
DROP TABLE IF EXISTS bot_keywords CASCADE;
DROP TABLE IF EXISTS bot_keyword_groups CASCADE;

-- 2. Eliminar tabla de opciones
DROP TABLE IF EXISTS bot_options CASCADE;

-- 3. Eliminar tabla de modalidades
DROP TABLE IF EXISTS bot_modalities CASCADE;

-- Confirmación
SELECT 'Tablas eliminadas exitosamente. Sistema listo para usar bot_rules.' AS status;
