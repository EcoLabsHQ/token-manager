# L2 Superchain Factory

Este proyecto implementa una fábrica de contratos inteligentes llamada `L2SuperChainTokenFactory`, que utiliza el método `create2` para desplegar contratos de manera que siempre tengan la misma dirección en diferentes cadenas. Esto permite una interoperabilidad y consistencia en el despliegue de contratos en múltiples redes.

## Estructura del Proyecto

- **src/**: Contiene los contratos inteligentes.
  - **L2SuperChainTokenFactory.sol**: Implementación de la fábrica que despliega contratos `L2SuperChainToken`.
  - **L2SuperChainToken.sol**: Definición del contrato de token, incluyendo la lógica de gestión de balances y transferencias.

- **script/**: Scripts para el despliegue de contratos.
  - **DeployL2SuperChainTokenFactory.s.sol**: Script para desplegar la fábrica `L2SuperChainTokenFactory`.
  - **DeploySalted.s.sol**: Script adicional para desplegar contratos utilizando un salt específico.

- **test/**: Contiene pruebas para la fábrica.
  - **L2SuperChainTokenFactory.t.sol**: Casos de prueba para verificar el correcto despliegue de contratos.

- **lib/**: Biblioteca de utilidades.
  - **forge-std**: Proporciona funciones estándar para el desarrollo y pruebas de contratos inteligentes.

- **foundry.toml**: Configuración del entorno de desarrollo y dependencias del proyecto.

- **.gitignore**: Reglas para ignorar archivos y directorios en el control de versiones.

## Instrucciones de Uso

1. **Instalación**: Asegúrate de tener [Foundry](https://book.getfoundry.sh/) instalado en tu entorno de desarrollo.

2. **Despliegue**: Utiliza el script `DeployL2SuperChainTokenFactory.s.sol` para desplegar la fábrica en la red deseada. Esto creará una instancia de `L2SuperChainTokenFactory`.

3. **Crear Tokens**: Una vez desplegada la fábrica, puedes utilizarla para crear instancias de `L2SuperChainToken` que tendrán direcciones predecibles en diferentes cadenas.

4. **Pruebas**: Ejecuta las pruebas en `L2SuperChainTokenFactory.t.sol` para asegurarte de que todo funciona como se espera.

## Contribuciones

Las contribuciones son bienvenidas. Si deseas contribuir, por favor abre un issue o un pull request en el repositorio.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT.