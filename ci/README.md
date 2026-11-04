# CI

`tests.yml` está listo pero **no activo**: el token de `gh` no tiene el scope
`workflow` y GitHub rechaza los ficheros de `.github/workflows/` sin él.

Para activarlo:

```bash
gh auth refresh -s workflow
mkdir -p .github/workflows
mv ci/tests.yml .github/workflows/tests.yml
git add .github/workflows/tests.yml
git commit -m "Activar CI"
git push
```

Después, añade el badge al README:

```md
![tests](https://github.com/Niltra/agent-skills-qa/actions/workflows/tests.yml/badge.svg)
```
