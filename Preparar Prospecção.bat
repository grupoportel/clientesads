@echo off
chcp 65001 >nul
title Preparar Prospeccao - CRM Grupo Portel
cd /d "%~dp0"

:menu
cls
echo.
echo  ============================================================
echo    PREPARAR PROSPECCAO
echo    Baixa a base de empresas da Receita Federal e separa
echo    por nicho e estado, para buscar leads dentro do CRM.
echo  ============================================================
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

echo    [1] Testar    - confere se a fonte esta no ar e se os nichos
echo                    batem. Baixa menos de 100 KB. Leva segundos.
echo.
echo    [2] Preparar  - baixa cerca de 5 GB, usa ate 17 GB temporarios
echo                    e gera as fatias. Pode levar horas.
echo.
echo    [3] Sair
echo.

set ESCOLHA=
set /p ESCOLHA="  O que voce quer fazer? (1, 2 ou 3): "

if "%ESCOLHA%"=="1" goto testar
if "%ESCOLHA%"=="2" goto preparar
if "%ESCOLHA%"=="3" exit /b 0
goto menu

:testar
echo.
node scripts\preparar-prospeccao.mjs --simular
echo.
echo  ------------------------------------------------------------
echo    Nada foi baixado de verdade. Se estiver tudo verde acima,
echo    rode a opcao 2 quando tiver tempo.
echo  ------------------------------------------------------------
echo.
pause
goto menu

:preparar
echo.
echo    Voce pode fechar esta janela a qualquer momento e clicar
echo    aqui de novo depois: o download continua de onde parou.
echo.
set LIMPAR=
set /p LIMPAR="  Apagar os 17 GB brutos no final? (S/N, padrao S): "
if /i "%LIMPAR%"=="N" (set FLAG=) else (set FLAG=--limpar)

echo.
node scripts\preparar-prospeccao.mjs %FLAG%

if errorlevel 1 (
    echo.
    echo  [X] Algo deu errado. Se foi queda de conexao, clique aqui
    echo      de novo: o download continua de onde parou.
) else (
    echo.
    echo  [OK] Pronto. Abra o CRM em Buscar Leads.
)
echo.
pause
exit /b 0
