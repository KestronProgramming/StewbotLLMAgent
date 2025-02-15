A project to revive the LLM responses in [Stewbot](https://github.com/KestronProgramming/Stewbot) by running self-hosted LLM agents on multiple servers with GPUs.

---
<br><br><br>

# Client Node Setup

For linux, ollama can be installed with:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

This adds an ollama service that, while not incompatable with this script, is unecessary. To disable it:
```bash
sudo systemctl disable ollama
```

For windows, ollama can be installed with:
```powershell
winget install Ollama.Ollama
```

---

<br><br><br>

# TODOs

Have all agents tunnel data through a stewbot VPN to allow all non-local GPU nodes to be accessed by the server.

I need to add a windows alternative to serve.sh. Possibly rewrite more of it in node.js?

---

All issues can be blamed on [@Reginald-Gillespie](https://github.com/Reginald-Gillespie)
