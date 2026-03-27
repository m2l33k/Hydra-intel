#!/usr/bin/env python3
# Verify all free HYDRA INTEL tools.
import shutil, sys, os
G="\033[92m"; R="\033[91m"; Y="\033[93m"; C="\033[96m"; B="\033[1m"; N="\033[0m"
ok=fail=warn=0

def chk_ok(m):
    global ok; ok+=1; print(f"  {G}[OK]{N}   {m}")
def chk_fail(m):
    global fail; fail+=1; print(f"  {R}[MISS]{N} {m}")
def chk_py(name, mod=None):
    mod = mod or name.replace("-","_")
    try: __import__(mod); chk_ok(f"pip: {name}")
    except ImportError: chk_fail(f"pip: {name}")
def chk_cmd(name):
    if shutil.which(name): chk_ok(f"cli: {name}")
    else: chk_fail(f"cli: {name}")

print(f"\n{B}{'='*56}{N}")
print(f"{B}  HYDRA INTEL -- Free Tools Verification{N}")
print(f"{B}{'='*56}{N}\n")

print(f"{C}-- Go CLI Binaries (11) --{N}")
for c in ["subfinder","httpx","katana","dnsx","nuclei","gitleaks","trufflehog",
          "amass","assetfinder","waybackurls","gau"]:
    chk_cmd(c)

print(f"\n{C}-- System Tools (7) --{N}")
for c in ["nmap","tor","dig","whois","traceroute","chromium","exiftool"]:
    chk_cmd(c)

print(f"\n{C}-- Python CLI Tools (7) --{N}")
for c in ["sherlock","maigret","holehe","h8mail","dnstwist","onionsearch","dnsrecon"]:
    chk_cmd(c)

print(f"\n{C}-- Python Libraries (20+) --{N}")
for name,mod in [
    ("requests","requests"),("beautifulsoup4","bs4"),("lxml","lxml"),
    ("fastapi","fastapi"),("uvicorn","uvicorn"),("pydantic","pydantic"),
    ("praw","praw"),("telethon","telethon"),("pyrogram","pyrogram"),
    ("python-nmap","nmap"),("nvdlib","nvdlib"),("yara-python","yara"),
    ("snscrape","snscrape"),("social-analyzer","social_analyzer"),
    ("dnstwist","dnstwist"),("ipinfo","ipinfo"),("netlas","netlas"),
    ("PySocks","socks"),("selenium","selenium"),
    ("python-dotenv","dotenv"),("httpx-lib","httpx"),
]:
    chk_py(name, mod)

print(f"\n{C}-- HYDRA Platform --{N}")
try:
    from core.tool_registry import ToolRegistry
    r = ToolRegistry(); chk_ok(f"Registry: {len(r.get_all_tools())} tools")
except Exception as e: chk_fail(f"Registry: {e}")
try:
    from core.tool_manager import ToolManager
    tm = ToolManager(); tm._register_builtin_executors()
    chk_ok(f"Executors: {len(tm.executor_registry.list_registered())}")
except Exception as e: chk_fail(f"Executors: {e}")

print(f"\n{B}{'='*56}{N}")
print(f"  {G}OK: {ok}{N}  |  {R}Missing: {fail}{N}")
print(f"{B}{'='*56}{N}\n")

# Free tools that work without ANY key:
print(f"{C}-- Tools usable right now (no API key) --{N}")
free = [
    "subfinder","httpx","katana","dnsx","nuclei","gitleaks","trufflehog",
    "amass","assetfinder","waybackurls","gau",
    "nmap","tor","whois","dig",
    "sherlock","maigret","holehe","h8mail","dnstwist","dnsrecon","onionsearch",
    "dnsdumpster (hackertarget API)","ipinfo (free tier)",
    "emailrep (free tier)","nvd (free)","reddit JSON API (no auth)",
    "ahmia (free)","psbdmp (free)","arctic-shift (free)",
    "wayback machine","common crawl via gau",
]
for t in free:
    print(f"  {G}*{N} {t}")
print(f"\n  Total: {len(free)} tools work without any API key\n")

sys.exit(1 if fail > 10 else 0)
