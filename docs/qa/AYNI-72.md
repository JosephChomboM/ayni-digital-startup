# AYNI-72 — Reglas de pausa como servicio aislado

**Revisado por QA:** Gonzalo Cáceres, 2 de noviembre de 2026.  
**Alcance:** evaluación pura de reacciones, sin historial persistido ni endpoint.

## Verificación

Desde `backend` se ejecutó:

```powershell
.venv\Scripts\python.exe -m pytest tests/unit/test_insights.py
```

**Resultado:** 32 pruebas aprobadas. Se cubren rachas, ventana completa e incompleta, límite de proporción, clasificación negativa, valores inválidos y que evaluar no modifique el historial entregado.

La suite es local y no necesita PostgreSQL ni servicios externos. Los umbrales son reglas provisionales del producto; esta prueba técnica no representa validación clínica.
