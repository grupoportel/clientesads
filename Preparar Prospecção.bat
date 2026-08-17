@echo off
chcp 65001 >nul
title Preparar Prospeccao - CRM Grupo Portel
cd /d "%~dp0"

echo.
echo  ============================================================
echo    PREPARAR PROSPECCAO
echo    Baixa a base de empresas da Receita Federal e separa
echo    por nicho e estado, para buscar leads dentro do CRM.
echo  ============================================================
echo.
echo    Isso vai baixar cerca de 5 GB e pode levar de 30 minutos
echo    a algumas horas, dependendo da sua internet.
echo.
echo    Voce pode fechar esta janela a qualquer momento e rodar
echo    de novo depois: ele continua de onde parou.
echo.
echo  ------------------------------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo  [X] O Node.js nao esta instalado.
    echo.
    echo      Baixe em https://nodejs.org e instale a versao LTS.
    echo      Depois e so clicar aqui de novo.
    echo.
    pause
    exit /b 1
)

set /p LIMPAR="  Apagar os arquivos brutos no final? (S/N, padrao S): "
if /i "%LIMPAR%"=="N" (
    set FLAG=
) else (
    set FLAG=--limpar
)

echo.
node scripts\preparar-prospeccao.mjs %FLAG%

if errorlevel 1 (
    echo.
    echo  [X] Algo deu errado. Se foi queda de conexao, rode de novo:
    echo      o download continua de onde parou.
) else (
    echo.
    echo  [OK] Pronto. Abra o CRM em Buscar Leads.
)

echo.
pause
