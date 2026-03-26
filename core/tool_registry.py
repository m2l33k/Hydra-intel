"""
HYDRA INTEL — Tool Registry

Central registry of all OSINT/security tools organized by target type.
Each tool has effectiveness scores, health status, fallback chains,
and installation/validation metadata.
"""

import enum
import time
import shutil
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable, Any


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TargetType(enum.Enum):
    """Intelligence collection target categories."""
    OSINT_SURFACE = "osint_surface"
    GITHUB_INTEL = "github_intel"
    REDDIT_INTEL = "reddit_intel"
    TELEGRAM_INTEL = "telegram_intel"
    DARK_WEB = "dark_web"
    PASTE_LEAKS = "paste_leaks"
    VULNERABILITY_INTEL = "vulnerability_intel"
    INFRASTRUCTURE_INTEL = "infrastructure_intel"
    THREAT_INTEL = "threat_intel"
    WHATSAPP_INTEL = "whatsapp_intel"
    SOCIAL_MEDIA_INTEL = "social_media_intel"
    EMAIL_INTEL = "email_intel"
    DNS_INTEL = "dns_intel"
    MALWARE_INTEL = "malware_intel"


class ToolStatus(enum.Enum):
    """Runtime status of a tool."""
    UNKNOWN = "unknown"
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    DEGRADED = "degraded"
    ERROR = "error"
    RATE_LIMITED = "rate_limited"
    AUTH_REQUIRED = "auth_required"


class ToolType(enum.Enum):
    """How the tool is invoked."""
    PYTHON_LIBRARY = "python_library"
    CLI_BINARY = "cli_binary"
    REST_API = "rest_api"
    HYBRID = "hybrid"


# ---------------------------------------------------------------------------
# Tool Definition
# ---------------------------------------------------------------------------

@dataclass
class ToolDefinition:
    """Complete definition of an OSINT/security tool."""
    name: str
    target_type: TargetType
    tool_type: ToolType
    description: str

    # Effectiveness & priority
    effectiveness: float = 0.5          # 0.0 - 1.0
    priority: int = 100                 # Lower = tried first

    # Installation
    python_package: Optional[str] = None        # pip install name
    cli_command: Optional[str] = None           # binary name for shutil.which
    api_base_url: Optional[str] = None          # REST endpoint
    install_commands: List[str] = field(default_factory=list)

    # Authentication
    requires_auth: bool = False
    auth_env_vars: List[str] = field(default_factory=list)
    auth_description: str = ""

    # Runtime state
    status: ToolStatus = ToolStatus.UNKNOWN
    last_check: float = 0.0
    last_error: Optional[str] = None
    consecutive_errors: int = 0
    total_runs: int = 0
    total_successes: int = 0
    avg_response_time: float = 0.0

    # Capabilities
    capabilities: List[str] = field(default_factory=list)
    output_formats: List[str] = field(default_factory=list)
    rate_limit: Optional[float] = None  # seconds between calls
    max_results_per_call: Optional[int] = None

    @property
    def success_rate(self) -> float:
        if self.total_runs == 0:
            return 0.0
        return self.total_successes / self.total_runs

    @property
    def health_score(self) -> float:
        """Dynamic health score combining effectiveness + runtime performance."""
        base = self.effectiveness
        if self.total_runs > 0:
            runtime_factor = self.success_rate
            base = (base * 0.4) + (runtime_factor * 0.6)
        if self.consecutive_errors > 0:
            penalty = min(self.consecutive_errors * 0.15, 0.6)
            base -= penalty
        if self.status == ToolStatus.RATE_LIMITED:
            base *= 0.5
        elif self.status == ToolStatus.ERROR:
            base *= 0.2
        elif self.status == ToolStatus.UNAVAILABLE:
            base = 0.0
        return max(0.0, min(1.0, base))

    def record_success(self, response_time: float = 0.0):
        self.total_runs += 1
        self.total_successes += 1
        self.consecutive_errors = 0
        self.last_error = None
        self.status = ToolStatus.AVAILABLE
        if response_time > 0:
            if self.avg_response_time == 0:
                self.avg_response_time = response_time
            else:
                self.avg_response_time = (self.avg_response_time * 0.7) + (response_time * 0.3)

    def record_failure(self, error: str):
        self.total_runs += 1
        self.consecutive_errors += 1
        self.last_error = error
        if self.consecutive_errors >= 5:
            self.status = ToolStatus.ERROR
        elif self.consecutive_errors >= 2:
            self.status = ToolStatus.DEGRADED

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "target_type": self.target_type.value,
            "tool_type": self.tool_type.value,
            "description": self.description,
            "effectiveness": self.effectiveness,
            "priority": self.priority,
            "status": self.status.value,
            "health_score": round(self.health_score, 3),
            "success_rate": round(self.success_rate, 3),
            "total_runs": self.total_runs,
            "consecutive_errors": self.consecutive_errors,
            "last_error": self.last_error,
            "python_package": self.python_package,
            "cli_command": self.cli_command,
            "install_commands": self.install_commands,
            "requires_auth": self.requires_auth,
            "auth_env_vars": self.auth_env_vars,
            "auth_description": self.auth_description,
            "capabilities": self.capabilities,
            "rate_limit": self.rate_limit,
        }


# ---------------------------------------------------------------------------
# Tool Registry
# ---------------------------------------------------------------------------

class ToolRegistry:
    """
    Central registry holding every known OSINT / security tool.

    Tools are organized by TargetType and sorted by priority within each
    category so the best tool is always tried first, with automatic
    fallback to alternatives.
    """

    def __init__(self):
        self._tools: Dict[str, ToolDefinition] = {}
        self._by_target: Dict[TargetType, List[str]] = {t: [] for t in TargetType}

        # Structured initialization for scoring/signature logic.
        self._tool_effectiveness = self._initialize_tool_effectiveness()
        self._technology_signatures = self._initialize_technology_signatures()

        self._register_all_tools()
        self._apply_effectiveness_overrides()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_tool(self, name: str) -> Optional[ToolDefinition]:
        return self._tools.get(name)

    def get_tools_for_target(self, target: TargetType) -> List[ToolDefinition]:
        """Return tools for a target type, sorted by priority then health."""
        names = self._by_target.get(target, [])
        tools = [self._tools[n] for n in names if n in self._tools]
        return sorted(tools, key=lambda t: (t.priority, -t.health_score))

    def get_best_tool(self, target: TargetType) -> Optional[ToolDefinition]:
        """Return the highest-ranked available tool for a target type."""
        for tool in self.get_tools_for_target(target):
            if tool.status not in (ToolStatus.UNAVAILABLE, ToolStatus.ERROR):
                return tool
        return None

    def get_fallback_chain(self, target: TargetType) -> List[ToolDefinition]:
        """Return ordered fallback chain (available tools, best first)."""
        return [
            t for t in self.get_tools_for_target(target)
            if t.status not in (ToolStatus.UNAVAILABLE,)
        ]

    def get_all_tools(self) -> List[ToolDefinition]:
        return list(self._tools.values())

    def get_tools_by_status(self, status: ToolStatus) -> List[ToolDefinition]:
        return [t for t in self._tools.values() if t.status == status]

    def get_target_types(self) -> List[Dict[str, Any]]:
        """Return summary of all target types and their tool counts."""
        result = []
        for target in TargetType:
            tools = self.get_tools_for_target(target)
            available = [t for t in tools if t.status == ToolStatus.AVAILABLE]
            result.append({
                "target_type": target.value,
                "total_tools": len(tools),
                "available_tools": len(available),
                "best_tool": tools[0].name if tools else None,
            })
        return result

    def check_tool_availability(self, name: str) -> ToolStatus:
        """Check if a tool is actually available on the system."""
        tool = self._tools.get(name)
        if not tool:
            return ToolStatus.UNAVAILABLE

        status = ToolStatus.UNAVAILABLE

        # Check Python library
        if tool.python_package:
            try:
                __import__(tool.python_package.split("[")[0].replace("-", "_"))
                status = ToolStatus.AVAILABLE
            except ImportError:
                pass

        # Check CLI binary
        if tool.cli_command and status != ToolStatus.AVAILABLE:
            if shutil.which(tool.cli_command):
                status = ToolStatus.AVAILABLE

        # Check REST API (just mark as available — actual test at runtime)
        if tool.api_base_url and status != ToolStatus.AVAILABLE:
            status = ToolStatus.AVAILABLE

        # Check auth requirements
        if status == ToolStatus.AVAILABLE and tool.requires_auth:
            import os
            if not all(os.environ.get(v) for v in tool.auth_env_vars):
                status = ToolStatus.AUTH_REQUIRED

        tool.status = status
        tool.last_check = time.time()
        return status

    def check_all_availability(self) -> Dict[str, str]:
        """Check availability of all tools. Returns {name: status}."""
        results = {}
        for name in self._tools:
            results[name] = self.check_tool_availability(name).value
        return results

    def get_effectiveness_matrix(self) -> Dict[str, Dict[str, float]]:
        """Return the full effectiveness matrix {target_type: {tool: score}}."""
        matrix = {}
        for target in TargetType:
            tools = self.get_tools_for_target(target)
            if tools:
                matrix[target.value] = {t.name: t.effectiveness for t in tools}
        return matrix

    def get_effectiveness_config(self) -> Dict[str, Dict[str, float]]:
        """Return the static configured effectiveness map."""
        return self._tool_effectiveness

    def get_technology_signatures(self) -> Dict[str, Dict[str, List[str]]]:
        """Return technology signatures used for pre/post-processing."""
        return self._technology_signatures

    def get_health_report(self) -> Dict[str, Any]:
        """Full health report across all tools."""
        all_tools = self.get_all_tools()
        return {
            "total_tools": len(all_tools),
            "available": len([t for t in all_tools if t.status == ToolStatus.AVAILABLE]),
            "unavailable": len([t for t in all_tools if t.status == ToolStatus.UNAVAILABLE]),
            "degraded": len([t for t in all_tools if t.status == ToolStatus.DEGRADED]),
            "error": len([t for t in all_tools if t.status == ToolStatus.ERROR]),
            "auth_required": len([t for t in all_tools if t.status == ToolStatus.AUTH_REQUIRED]),
            "by_target": {
                target.value: {
                    "total": len(self.get_tools_for_target(target)),
                    "healthy": len([
                        t for t in self.get_tools_for_target(target)
                        if t.status == ToolStatus.AVAILABLE
                    ]),
                }
                for target in TargetType
            },
            "tools": [t.to_dict() for t in all_tools],
        }


    def _initialize_tool_effectiveness(self) -> Dict[str, Dict[str, float]]:
        """Advanced default effectiveness map used to weight tool selection."""
        return {
            TargetType.OSINT_SURFACE.value: {
                "spiderfoot": 0.95,
                "recon-ng": 0.90,
                "theharvester": 0.88,
                "amass": 0.90,
                "photon": 0.85,
                "metagoofil": 0.82,
                "foca": 0.85,
                "googledorks": 0.80,
            },
            TargetType.GITHUB_INTEL.value: {
                "gitleaks": 0.96,
                "trufflehog": 0.95,
                "github-api": 0.90,
                "gitrob": 0.85,
                "git-hound": 0.90,
                "github-dorks": 0.90,
                "gharchive": 0.88,
            },
            TargetType.REDDIT_INTEL.value: {
                "praw": 0.90,
                "reddit-json-api": 0.85,
                "arctic-shift": 0.88,
                "snscrape": 0.92,
                "pushshift-wrapper": 0.88,
            },
            TargetType.TELEGRAM_INTEL.value: {
                "telethon": 0.95,
                "telegram-scraper": 0.90,
                "telegram-history-dump": 0.88,
                "telepathy": 0.90,
                "telegram-bot-api": 0.75,
            },
            TargetType.WHATSAPP_INTEL.value: {
                "whatsapp-web-api": 0.88,
                "chat-export-parser": 0.85,
                "wa-group-link-scraper": 0.80,
                "wppconnect": 0.83,
            },
            TargetType.DARK_WEB.value: {
                "tor-requests": 0.90,
                "onionsearch": 0.90,
                "onionscan": 0.88,
                "ahmia": 0.85,
            },
            TargetType.PASTE_LEAKS.value: {
                "intelligence-x": 0.94,
                "psbdmp-api": 0.92,
                "pastehunter": 0.88,
                "pastebin-scrape-api": 0.90,
                "pastemon": 0.90,
            },
            TargetType.VULNERABILITY_INTEL.value: {
                "cve-search": 0.95,
                "nvdlib": 0.90,
                "exploitdb": 0.88,
                "vulners-api": 0.90,
                "osv-api": 0.87,
            },
            TargetType.INFRASTRUCTURE_INTEL.value: {
                "shodan-cli": 0.95,
                "censys": 0.90,
                "ivre": 0.88,
                "theharvester": 0.85,
            },
            TargetType.THREAT_INTEL.value: {
                "misp": 0.97,
                "opencti": 0.98,
                "yara-python": 0.90,
                "maltrail": 0.85,
                "otx-alienvault": 0.92,
                "abuse-ipdb": 0.85,
            },
            TargetType.MALWARE_INTEL.value: {
                "virustotal-api": 0.96,
                "malwarebazaar": 0.90,
                "yara-python": 0.90,
            },
        }

    def _initialize_technology_signatures(self) -> Dict[str, Dict[str, List[str]]]:
        """Technology/IOC signatures used for enrichment and quick classification."""
        return {
            "leak_patterns": {
                "aws_keys": ["AKIA", "aws_secret_access_key", "ASIA"],
                "api_keys": ["api_key", "token", "secret", "x-api-key", "bearer"],
                "private_keys": ["BEGIN RSA PRIVATE KEY", "BEGIN OPENSSH PRIVATE KEY", "BEGIN EC PRIVATE KEY"],
                "passwords": ["password=", "passwd=", "pwd=", "db_password"],
            },
            "threat_keywords": {
                "exploits": ["exploit", "0day", "rce", "privilege escalation", "weaponized"],
                "breaches": ["breach", "leak", "dump", "data exposure", "credential stuffing"],
                "malware": ["ransomware", "stealer", "botnet", "dropper", "infostealer"],
            },
            "ioc_patterns": {
                "ip": [r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b"],
                "domain": [r"\b[a-zA-Z0-9.-]+\.(?:com|net|org|io|co|biz|ru|cn)\b"],
                "hash": [r"\b[a-fA-F0-9]{32}\b", r"\b[a-fA-F0-9]{40}\b", r"\b[a-fA-F0-9]{64}\b"],
                "cve": [r"\bCVE-\d{4}-\d{4,7}\b"],
            },
            "actor_patterns": {
                "apt": ["APT", "threat group", "nation state", "campaign"],
                "hackers": ["hacker", "cybercrime", "ransom gang", "affiliate"],
            },
        }

    def _apply_effectiveness_overrides(self):
        """Apply configured effectiveness to registered tools, adding placeholders when needed."""
        for target_name, score_map in self._tool_effectiveness.items():
            try:
                target = TargetType(target_name)
            except ValueError:
                continue

            for tool_name, score in score_map.items():
                tool = self._tools.get(tool_name)
                if tool:
                    tool.effectiveness = score
                    continue

                self._register(ToolDefinition(
                    name=tool_name,
                    target_type=target,
                    tool_type=ToolType.CLI_BINARY,
                    description=f"Alternative {target.value} tool placeholder",
                    effectiveness=score,
                    priority=95,
                    cli_command=tool_name,
                    capabilities=["intel_collection"],
                    output_formats=["json"],
                ))

    # ------------------------------------------------------------------
    # Registration helper
    # ------------------------------------------------------------------

    def _register(self, tool: ToolDefinition):
        self._tools[tool.name] = tool
        self._by_target[tool.target_type].append(tool.name)

    # ------------------------------------------------------------------
    # All tool definitions
    # ------------------------------------------------------------------

    def _register_all_tools(self):
        self._register_osint_surface_tools()
        self._register_github_tools()
        self._register_reddit_tools()
        self._register_telegram_tools()
        self._register_dark_web_tools()
        self._register_paste_leak_tools()
        self._register_vulnerability_tools()
        self._register_infrastructure_tools()
        self._register_threat_intel_tools()
        self._register_whatsapp_tools()
        self._register_social_media_tools()
        self._register_email_tools()
        self._register_dns_tools()
        self._register_malware_tools()

    # ---- OSINT Surface ------------------------------------------------

    def _register_osint_surface_tools(self):
        self._register(ToolDefinition(
            name="spiderfoot",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.HYBRID,
            description="Automated OSINT reconnaissance with 200+ modules for domains, IPs, emails, names",
            effectiveness=0.95,
            priority=10,
            python_package="spiderfoot",
            cli_command="spiderfoot",
            install_commands=["pip install spiderfoot"],
            capabilities=["domain_recon", "email_enum", "ip_intel", "social_profiles", "data_breach_check",
                          "dns_enum", "whois", "certificate_transparency", "web_scraping"],
            output_formats=["json", "csv", "gexf"],
            max_results_per_call=1000,
        ))
        self._register(ToolDefinition(
            name="recon-ng",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.CLI_BINARY,
            description="Full-featured web reconnaissance framework with marketplace modules",
            effectiveness=0.92,
            priority=20,
            python_package="recon-ng",
            cli_command="recon-ng",
            install_commands=["pip install recon-ng"],
            capabilities=["domain_recon", "contact_enum", "credential_harvest", "social_recon",
                          "reverse_dns", "geolocation", "port_scan"],
            output_formats=["json", "csv", "html", "xlsx"],
            max_results_per_call=500,
        ))
        self._register(ToolDefinition(
            name="theharvester",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.CLI_BINARY,
            description="Email, subdomain, and name harvester from public sources (Google, Bing, LinkedIn, etc.)",
            effectiveness=0.88,
            priority=30,
            python_package="theHarvester",
            cli_command="theHarvester",
            install_commands=["pip install theHarvester"],
            capabilities=["email_harvest", "subdomain_enum", "host_discovery", "virtual_host_discovery"],
            output_formats=["json", "xml", "html"],
            max_results_per_call=500,
        ))
        self._register(ToolDefinition(
            name="amass",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.CLI_BINARY,
            description="In-depth attack surface mapping and asset discovery via DNS enumeration",
            effectiveness=0.93,
            priority=15,
            cli_command="amass",
            install_commands=["go install -v github.com/owasp-amass/amass/v4/...@master"],
            capabilities=["subdomain_enum", "dns_brute", "certificate_transparency", "web_archive",
                          "asn_discovery", "network_mapping"],
            output_formats=["json", "csv", "txt"],
            max_results_per_call=10000,
        ))
        self._register(ToolDefinition(
            name="photon",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Fast web crawler designed for OSINT — extracts URLs, emails, social media, files",
            effectiveness=0.85,
            priority=40,
            python_package="photon",
            install_commands=["pip install photon"],
            capabilities=["web_crawl", "url_extraction", "email_extraction", "file_discovery",
                          "subdomain_discovery", "js_file_extraction"],
            output_formats=["json", "txt"],
        ))
        self._register(ToolDefinition(
            name="metagoofil",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.CLI_BINARY,
            description="Metadata extraction from public documents (PDF, DOC, XLS, PPT) for usernames & paths",
            effectiveness=0.82,
            priority=50,
            python_package="metagoofil",
            cli_command="metagoofil",
            install_commands=["pip install metagoofil"],
            capabilities=["metadata_extraction", "username_harvest", "path_discovery", "software_fingerprint"],
            output_formats=["json", "html"],
        ))
        self._register(ToolDefinition(
            name="googledorks",
            target_type=TargetType.OSINT_SURFACE,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Google dorking automation for finding exposed data, admin panels, and sensitive files",
            effectiveness=0.80,
            priority=60,
            python_package="googlesearch-python",
            install_commands=["pip install googlesearch-python"],
            capabilities=["google_dorking", "exposed_file_discovery", "admin_panel_discovery"],
            output_formats=["json", "txt"],
            rate_limit=5.0,
        ))

    # ---- GitHub Intel -------------------------------------------------

    def _register_github_tools(self):
        self._register(ToolDefinition(
            name="gitleaks",
            target_type=TargetType.GITHUB_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Scan git repos for hardcoded secrets (API keys, passwords, tokens) using regex rules",
            effectiveness=0.96,
            priority=10,
            cli_command="gitleaks",
            install_commands=["go install github.com/gitleaks/gitleaks/v8@latest"],
            capabilities=["secret_detection", "commit_scanning", "pre_commit_hook", "baseline_support",
                          "custom_rules", "sarif_output"],
            output_formats=["json", "csv", "sarif"],
            max_results_per_call=10000,
        ))
        self._register(ToolDefinition(
            name="trufflehog",
            target_type=TargetType.GITHUB_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Find verified secrets in git repos, S3, GCS — validates credentials are active",
            effectiveness=0.95,
            priority=15,
            cli_command="trufflehog",
            python_package="trufflehog",
            install_commands=["pip install trufflehog", "go install github.com/trufflesecurity/trufflehog/v3@latest"],
            capabilities=["secret_detection", "credential_verification", "entropy_analysis",
                          "s3_scanning", "gcs_scanning", "git_history_scan"],
            output_formats=["json", "plain"],
            max_results_per_call=5000,
        ))
        self._register(ToolDefinition(
            name="github-api",
            target_type=TargetType.GITHUB_INTEL,
            tool_type=ToolType.REST_API,
            description="GitHub REST API v3 — code search, repo search, commit search, user enumeration",
            effectiveness=0.90,
            priority=20,
            api_base_url="https://api.github.com",
            requires_auth=False,
            auth_env_vars=["GITHUB_TOKEN"],
            auth_description="Personal access token for higher rate limits (5000/hr vs 60/hr)",
            capabilities=["code_search", "repo_search", "commit_search", "user_enum",
                          "org_enum", "gist_search", "issue_search"],
            output_formats=["json"],
            rate_limit=1.0,
            max_results_per_call=1000,
        ))
        self._register(ToolDefinition(
            name="git-hound",
            target_type=TargetType.GITHUB_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Git plugin for finding exposed API keys using pattern matching and Shannon entropy",
            effectiveness=0.88,
            priority=30,
            cli_command="git-hound",
            install_commands=["go install github.com/tillson/git-hound@latest"],
            capabilities=["secret_detection", "entropy_analysis", "pattern_matching"],
            output_formats=["json", "plain"],
        ))
        self._register(ToolDefinition(
            name="github-dorks",
            target_type=TargetType.GITHUB_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Automated GitHub dorking for finding sensitive data in repos using predefined queries",
            effectiveness=0.85,
            priority=35,
            python_package="github-dorks",
            install_commands=["pip install github-dorks"],
            requires_auth=True,
            auth_env_vars=["GITHUB_TOKEN"],
            capabilities=["dork_search", "sensitive_file_discovery", "credential_exposure"],
            output_formats=["json", "txt"],
        ))
        self._register(ToolDefinition(
            name="gitrob",
            target_type=TargetType.GITHUB_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Find sensitive files pushed to GitHub repos by scanning organizations and users",
            effectiveness=0.83,
            priority=40,
            cli_command="gitrob",
            install_commands=["go install github.com/michenriksen/gitrob@latest"],
            requires_auth=True,
            auth_env_vars=["GITHUB_TOKEN"],
            capabilities=["org_scan", "user_scan", "sensitive_file_detection"],
            output_formats=["json"],
        ))

    # ---- Reddit Intel -------------------------------------------------

    def _register_reddit_tools(self):
        self._register(ToolDefinition(
            name="praw",
            target_type=TargetType.REDDIT_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Official Python Reddit API Wrapper — full access to Reddit's API for posts, comments, users",
            effectiveness=0.92,
            priority=10,
            python_package="praw",
            install_commands=["pip install praw"],
            requires_auth=True,
            auth_env_vars=["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
            auth_description="Reddit OAuth2 app credentials (script type)",
            capabilities=["subreddit_search", "post_search", "comment_search", "user_history",
                          "submission_stream", "comment_stream", "moderation"],
            output_formats=["json"],
            rate_limit=1.0,
            max_results_per_call=1000,
        ))
        self._register(ToolDefinition(
            name="reddit-json-api",
            target_type=TargetType.REDDIT_INTEL,
            tool_type=ToolType.REST_API,
            description="Reddit's public JSON API (.json suffix) — no auth needed, good for basic searches",
            effectiveness=0.85,
            priority=20,
            api_base_url="https://www.reddit.com",
            capabilities=["subreddit_search", "post_listing", "comment_listing"],
            output_formats=["json"],
            rate_limit=2.0,
            max_results_per_call=100,
        ))
        self._register(ToolDefinition(
            name="arctic-shift",
            target_type=TargetType.REDDIT_INTEL,
            tool_type=ToolType.REST_API,
            description="Arctic Shift API — Reddit archive search for historical posts and comments (Pushshift successor)",
            effectiveness=0.88,
            priority=15,
            api_base_url="https://arctic-shift.photon-reddit.com/api",
            capabilities=["historical_search", "comment_search", "user_history", "subreddit_archive",
                          "deleted_content"],
            output_formats=["json"],
            rate_limit=1.0,
            max_results_per_call=500,
        ))
        self._register(ToolDefinition(
            name="reddit-html-scraper",
            target_type=TargetType.REDDIT_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Fallback HTML scraper for old.reddit.com when API access is blocked or rate-limited",
            effectiveness=0.70,
            priority=50,
            python_package="beautifulsoup4",
            install_commands=["pip install beautifulsoup4 requests"],
            capabilities=["subreddit_scrape", "post_listing"],
            output_formats=["json"],
            rate_limit=3.0,
        ))

    # ---- Telegram Intel -----------------------------------------------

    def _register_telegram_tools(self):
        self._register(ToolDefinition(
            name="telethon",
            target_type=TargetType.TELEGRAM_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Full Telegram client library — access channels, groups, messages, users, media",
            effectiveness=0.95,
            priority=10,
            python_package="telethon",
            install_commands=["pip install telethon"],
            requires_auth=True,
            auth_env_vars=["TELEGRAM_API_ID", "TELEGRAM_API_HASH"],
            auth_description="Telegram API credentials from my.telegram.org",
            capabilities=["channel_monitor", "group_monitor", "message_search", "user_lookup",
                          "media_download", "message_history", "forward_tracking"],
            output_formats=["json"],
            max_results_per_call=5000,
        ))
        self._register(ToolDefinition(
            name="telepathy",
            target_type=TargetType.TELEGRAM_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="OSINT toolkit for Telegram — channel analysis, member enumeration, message archiving",
            effectiveness=0.90,
            priority=20,
            python_package="telepathy",
            cli_command="telepathy",
            install_commands=["pip install telepathy-osint"],
            requires_auth=True,
            auth_env_vars=["TELEGRAM_API_ID", "TELEGRAM_API_HASH"],
            capabilities=["channel_analysis", "member_enum", "message_archive", "network_mapping",
                          "media_extraction"],
            output_formats=["json", "csv", "html"],
        ))
        self._register(ToolDefinition(
            name="telegram-scraper",
            target_type=TargetType.TELEGRAM_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Lightweight Telegram channel scraper for monitoring threat actor communications",
            effectiveness=0.85,
            priority=30,
            python_package="telegram-scraper",
            install_commands=["pip install telegram-scraper"],
            requires_auth=True,
            auth_env_vars=["TELEGRAM_API_ID", "TELEGRAM_API_HASH"],
            capabilities=["channel_scrape", "message_extraction"],
            output_formats=["json", "csv"],
        ))
        self._register(ToolDefinition(
            name="telegram-bot-api",
            target_type=TargetType.TELEGRAM_INTEL,
            tool_type=ToolType.REST_API,
            description="Telegram Bot API — monitor channels via bot, limited but no full client auth needed",
            effectiveness=0.75,
            priority=40,
            api_base_url="https://api.telegram.org",
            requires_auth=True,
            auth_env_vars=["TELEGRAM_BOT_TOKEN"],
            auth_description="Bot token from @BotFather",
            capabilities=["channel_monitor", "message_receive", "group_monitor"],
            output_formats=["json"],
        ))

    # ---- Dark Web -----------------------------------------------------

    def _register_dark_web_tools(self):
        self._register(ToolDefinition(
            name="onionsearch",
            target_type=TargetType.DARK_WEB,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Search engine scraper for .onion sites across multiple dark web search engines",
            effectiveness=0.90,
            priority=10,
            python_package="onionsearch",
            cli_command="onionsearch",
            install_commands=["pip install onionsearch"],
            capabilities=["dark_web_search", "onion_discovery", "multi_engine_search"],
            output_formats=["json", "csv", "txt"],
            rate_limit=5.0,
        ))
        self._register(ToolDefinition(
            name="ahmia",
            target_type=TargetType.DARK_WEB,
            tool_type=ToolType.REST_API,
            description="Ahmia.fi search engine API for .onion hidden services (clearnet accessible)",
            effectiveness=0.85,
            priority=20,
            api_base_url="https://ahmia.fi",
            capabilities=["onion_search", "hidden_service_index"],
            output_formats=["json", "html"],
            rate_limit=2.0,
        ))
        self._register(ToolDefinition(
            name="tor-requests",
            target_type=TargetType.DARK_WEB,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Route requests through Tor SOCKS proxy for .onion site access",
            effectiveness=0.88,
            priority=15,
            python_package="requests",
            install_commands=["pip install requests[socks] PySocks"],
            capabilities=["onion_access", "hidden_service_crawl", "anonymized_requests"],
            output_formats=["json", "html"],
            rate_limit=5.0,
        ))
        self._register(ToolDefinition(
            name="onionscan",
            target_type=TargetType.DARK_WEB,
            tool_type=ToolType.CLI_BINARY,
            description="Investigate dark web sites for operational security issues and deanonymization vectors",
            effectiveness=0.85,
            priority=25,
            cli_command="onionscan",
            install_commands=["go install github.com/s-rah/onionscan@latest"],
            capabilities=["opsec_analysis", "server_fingerprint", "correlation_detection",
                          "apache_mod_status", "open_directories"],
            output_formats=["json"],
        ))

    # ---- Paste / Leak Sites -------------------------------------------

    def _register_paste_leak_tools(self):
        self._register(ToolDefinition(
            name="pastehunter",
            target_type=TargetType.PASTE_LEAKS,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Monitor paste sites for sensitive data using YARA rules — supports multiple paste sources",
            effectiveness=0.92,
            priority=10,
            python_package="pastehunter",
            install_commands=["pip install pastehunter"],
            capabilities=["paste_monitor", "yara_matching", "multi_source", "regex_matching",
                          "keyword_alerting"],
            output_formats=["json"],
        ))
        self._register(ToolDefinition(
            name="psbdmp-api",
            target_type=TargetType.PASTE_LEAKS,
            tool_type=ToolType.REST_API,
            description="Pastebin dump search API — search leaked credentials and sensitive data on Pastebin",
            effectiveness=0.88,
            priority=20,
            api_base_url="https://psbdmp.ws/api",
            capabilities=["paste_search", "email_search", "credential_search"],
            output_formats=["json"],
            rate_limit=2.0,
        ))
        self._register(ToolDefinition(
            name="pastebin-scrape-api",
            target_type=TargetType.PASTE_LEAKS,
            tool_type=ToolType.REST_API,
            description="Pastebin's official scraping API — real-time access to new public pastes",
            effectiveness=0.85,
            priority=25,
            api_base_url="https://scrape.pastebin.com",
            capabilities=["recent_pastes", "paste_content", "real_time_monitor"],
            output_formats=["json"],
            rate_limit=1.0,
            max_results_per_call=250,
        ))
        self._register(ToolDefinition(
            name="intelligence-x",
            target_type=TargetType.PASTE_LEAKS,
            tool_type=ToolType.REST_API,
            description="Intelligence X API — search across pastes, leaks, darknet, whois, and more",
            effectiveness=0.94,
            priority=5,
            api_base_url="https://2.intelx.io",
            requires_auth=True,
            auth_env_vars=["INTELX_API_KEY"],
            auth_description="Intelligence X API key (free tier available)",
            capabilities=["paste_search", "leak_search", "darknet_search", "whois_search",
                          "email_search", "domain_search", "bitcoin_search"],
            output_formats=["json"],
            rate_limit=1.0,
        ))

    # ---- Vulnerability Intel ------------------------------------------

    def _register_vulnerability_tools(self):
        self._register(ToolDefinition(
            name="cve-search",
            target_type=TargetType.VULNERABILITY_INTEL,
            tool_type=ToolType.REST_API,
            description="CIRCL CVE search API — fast, comprehensive CVE database with CVSS scores and references",
            effectiveness=0.95,
            priority=10,
            api_base_url="https://cve.circl.lu",
            capabilities=["cve_lookup", "cve_search", "cpe_match", "recent_cves",
                          "cvss_scoring", "reference_links"],
            output_formats=["json"],
            rate_limit=1.0,
            max_results_per_call=100,
        ))
        self._register(ToolDefinition(
            name="nvdlib",
            target_type=TargetType.VULNERABILITY_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Python wrapper for NIST NVD API 2.0 — official CVE data with full CVSS metrics",
            effectiveness=0.93,
            priority=15,
            python_package="nvdlib",
            install_commands=["pip install nvdlib"],
            requires_auth=False,
            auth_env_vars=["NVD_API_KEY"],
            auth_description="NVD API key for higher rate limits (optional)",
            capabilities=["cve_search", "cpe_search", "cvss_lookup", "cwe_mapping",
                          "date_range_search", "keyword_search"],
            output_formats=["json"],
            rate_limit=6.0,
            max_results_per_call=2000,
        ))
        self._register(ToolDefinition(
            name="vulners-api",
            target_type=TargetType.VULNERABILITY_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Vulners.com API — vulnerability database aggregating NVD, exploit-db, and vendor advisories",
            effectiveness=0.90,
            priority=20,
            python_package="vulners",
            install_commands=["pip install vulners"],
            requires_auth=True,
            auth_env_vars=["VULNERS_API_KEY"],
            auth_description="Free API key from vulners.com",
            capabilities=["vuln_search", "exploit_search", "software_audit", "cpe_match",
                          "ai_scoring"],
            output_formats=["json"],
            rate_limit=1.0,
        ))
        self._register(ToolDefinition(
            name="exploitdb",
            target_type=TargetType.VULNERABILITY_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="SearchSploit CLI — offline copy of Exploit-DB for finding public exploits and shellcode",
            effectiveness=0.88,
            priority=25,
            cli_command="searchsploit",
            install_commands=["sudo apt install exploitdb"],
            capabilities=["exploit_search", "shellcode_search", "paper_search", "offline_search"],
            output_formats=["json", "csv", "txt"],
        ))
        self._register(ToolDefinition(
            name="osv-api",
            target_type=TargetType.VULNERABILITY_INTEL,
            tool_type=ToolType.REST_API,
            description="Google OSV API — open source vulnerability database covering npm, PyPI, Go, and more",
            effectiveness=0.87,
            priority=30,
            api_base_url="https://api.osv.dev",
            capabilities=["package_vuln_search", "ecosystem_search", "version_match"],
            output_formats=["json"],
            rate_limit=1.0,
        ))

    # ---- Infrastructure Intel -----------------------------------------

    def _register_infrastructure_tools(self):
        self._register(ToolDefinition(
            name="shodan-cli",
            target_type=TargetType.INFRASTRUCTURE_INTEL,
            tool_type=ToolType.HYBRID,
            description="Shodan — search engine for internet-connected devices, ports, banners, and vulnerabilities",
            effectiveness=0.96,
            priority=10,
            python_package="shodan",
            cli_command="shodan",
            install_commands=["pip install shodan"],
            requires_auth=True,
            auth_env_vars=["SHODAN_API_KEY"],
            auth_description="Shodan API key (free tier: 100 results/month)",
            capabilities=["ip_lookup", "port_scan", "banner_grab", "vuln_detection",
                          "ssl_cert_search", "device_search", "org_search", "network_scan"],
            output_formats=["json", "csv"],
            rate_limit=1.0,
            max_results_per_call=100,
        ))
        self._register(ToolDefinition(
            name="censys",
            target_type=TargetType.INFRASTRUCTURE_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Censys — internet-wide scan data for hosts, certificates, and services",
            effectiveness=0.93,
            priority=15,
            python_package="censys",
            install_commands=["pip install censys"],
            requires_auth=True,
            auth_env_vars=["CENSYS_API_ID", "CENSYS_API_SECRET"],
            auth_description="Censys API credentials from censys.io/account/api",
            capabilities=["host_search", "certificate_search", "service_scan",
                          "autonomous_system", "protocol_detection"],
            output_formats=["json"],
            rate_limit=2.0,
        ))
        self._register(ToolDefinition(
            name="zoomeye",
            target_type=TargetType.INFRASTRUCTURE_INTEL,
            tool_type=ToolType.REST_API,
            description="ZoomEye — cyberspace search engine (Chinese alternative to Shodan) for device & web discovery",
            effectiveness=0.88,
            priority=25,
            api_base_url="https://api.zoomeye.org",
            python_package="zoomeye",
            install_commands=["pip install zoomeye"],
            requires_auth=True,
            auth_env_vars=["ZOOMEYE_API_KEY"],
            capabilities=["host_search", "web_search", "device_discovery", "banner_search"],
            output_formats=["json"],
            rate_limit=2.0,
        ))
        self._register(ToolDefinition(
            name="nmap-python",
            target_type=TargetType.INFRASTRUCTURE_INTEL,
            tool_type=ToolType.HYBRID,
            description="Python-nmap — programmatic interface to Nmap scanner for port/service/OS detection",
            effectiveness=0.90,
            priority=20,
            python_package="python-nmap",
            cli_command="nmap",
            install_commands=["pip install python-nmap"],
            capabilities=["port_scan", "service_detection", "os_detection", "script_scan",
                          "vuln_scan", "network_discovery"],
            output_formats=["json", "xml"],
        ))

    # ---- Threat Intel -------------------------------------------------

    def _register_threat_intel_tools(self):
        self._register(ToolDefinition(
            name="misp",
            target_type=TargetType.THREAT_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="MISP — open source threat intelligence platform for sharing, storing, and correlating IOCs",
            effectiveness=0.97,
            priority=5,
            python_package="pymisp",
            install_commands=["pip install pymisp"],
            requires_auth=True,
            auth_env_vars=["MISP_URL", "MISP_KEY"],
            auth_description="MISP instance URL and API key",
            capabilities=["ioc_sharing", "event_creation", "correlation", "taxonomy",
                          "galaxy_mapping", "feed_sync", "sighting_tracking"],
            output_formats=["json", "stix", "csv", "xml"],
        ))
        self._register(ToolDefinition(
            name="opencti",
            target_type=TargetType.THREAT_INTEL,
            tool_type=ToolType.REST_API,
            description="OpenCTI — cyber threat intelligence platform with STIX2 native support and GraphQL API",
            effectiveness=0.96,
            priority=10,
            python_package="pycti",
            install_commands=["pip install pycti"],
            requires_auth=True,
            auth_env_vars=["OPENCTI_URL", "OPENCTI_TOKEN"],
            auth_description="OpenCTI instance URL and bearer token",
            capabilities=["stix_import", "stix_export", "indicator_management", "report_management",
                          "threat_actor_tracking", "campaign_tracking", "relationship_mapping"],
            output_formats=["json", "stix2", "csv"],
        ))
        self._register(ToolDefinition(
            name="yara-python",
            target_type=TargetType.THREAT_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="YARA rule engine — pattern matching for malware classification and IOC detection",
            effectiveness=0.92,
            priority=15,
            python_package="yara-python",
            install_commands=["pip install yara-python"],
            capabilities=["pattern_matching", "malware_classification", "file_scanning",
                          "memory_scanning", "rule_compilation"],
            output_formats=["json"],
        ))
        self._register(ToolDefinition(
            name="otx-alienvault",
            target_type=TargetType.THREAT_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="AlienVault OTX — open threat exchange for IOCs, pulses, and community-driven threat intel",
            effectiveness=0.88,
            priority=20,
            python_package="OTXv2",
            install_commands=["pip install OTXv2"],
            requires_auth=True,
            auth_env_vars=["OTX_API_KEY"],
            auth_description="Free OTX API key from otx.alienvault.com",
            capabilities=["ioc_lookup", "pulse_search", "indicator_search", "domain_intel",
                          "ip_intel", "file_intel", "url_intel"],
            output_formats=["json"],
        ))
        self._register(ToolDefinition(
            name="abuse-ipdb",
            target_type=TargetType.THREAT_INTEL,
            tool_type=ToolType.REST_API,
            description="AbuseIPDB — community-driven IP abuse reporting and checking database",
            effectiveness=0.85,
            priority=25,
            api_base_url="https://api.abuseipdb.com/api/v2",
            requires_auth=True,
            auth_env_vars=["ABUSEIPDB_API_KEY"],
            auth_description="Free API key from abuseipdb.com",
            capabilities=["ip_check", "ip_report", "blacklist_check", "network_check"],
            output_formats=["json"],
            rate_limit=1.0,
        ))

    # ---- WhatsApp Intel -----------------------------------------------

    def _register_whatsapp_tools(self):
        self._register(ToolDefinition(
            name="whatsapp-web-api",
            target_type=TargetType.WHATSAPP_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="WhatsApp Web automation via Selenium/Playwright for group monitoring and message extraction",
            effectiveness=0.80,
            priority=10,
            python_package="selenium",
            install_commands=["pip install selenium webdriver-manager"],
            capabilities=["group_monitor", "message_extraction", "contact_enum", "media_download"],
            output_formats=["json"],
            rate_limit=5.0,
        ))
        self._register(ToolDefinition(
            name="chat-export-parser",
            target_type=TargetType.WHATSAPP_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Parse exported WhatsApp chat files (.txt) for analysis — timestamps, media, links",
            effectiveness=0.85,
            priority=20,
            python_package="whatstk",
            install_commands=["pip install whatstk"],
            capabilities=["chat_parse", "timeline_analysis", "user_stats", "link_extraction",
                          "media_tracking"],
            output_formats=["json", "csv"],
        ))
        self._register(ToolDefinition(
            name="wa-group-link-scraper",
            target_type=TargetType.WHATSAPP_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Discover and analyze public WhatsApp group invite links from the web",
            effectiveness=0.75,
            priority=30,
            python_package="requests",
            install_commands=["pip install requests beautifulsoup4"],
            capabilities=["group_link_discovery", "invite_link_analysis", "group_metadata"],
            output_formats=["json"],
            rate_limit=3.0,
        ))

    # ---- Social Media Intel -------------------------------------------

    def _register_social_media_tools(self):
        self._register(ToolDefinition(
            name="sherlock",
            target_type=TargetType.SOCIAL_MEDIA_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Hunt usernames across 400+ social networks simultaneously",
            effectiveness=0.93,
            priority=10,
            python_package="sherlock-project",
            cli_command="sherlock",
            install_commands=["pip install sherlock-project"],
            capabilities=["username_search", "social_profile_discovery", "cross_platform_correlation"],
            output_formats=["json", "csv", "txt"],
        ))
        self._register(ToolDefinition(
            name="maigret",
            target_type=TargetType.SOCIAL_MEDIA_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Advanced username OSINT across 2500+ sites with profile parsing and analysis",
            effectiveness=0.95,
            priority=5,
            python_package="maigret",
            cli_command="maigret",
            install_commands=["pip install maigret"],
            capabilities=["username_search", "profile_parsing", "social_graph", "identity_correlation",
                          "report_generation"],
            output_formats=["json", "csv", "html", "pdf"],
        ))
        self._register(ToolDefinition(
            name="social-analyzer",
            target_type=TargetType.SOCIAL_MEDIA_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="API and web app for analyzing social media profiles using OSINT techniques",
            effectiveness=0.85,
            priority=20,
            python_package="social-analyzer",
            install_commands=["pip install social-analyzer"],
            capabilities=["profile_analysis", "name_search", "company_search", "social_detection"],
            output_formats=["json"],
        ))

    # ---- Email Intel --------------------------------------------------

    def _register_email_tools(self):
        self._register(ToolDefinition(
            name="holehe",
            target_type=TargetType.EMAIL_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Check if an email is registered on 120+ websites (login/register oracle attacks)",
            effectiveness=0.90,
            priority=10,
            python_package="holehe",
            cli_command="holehe",
            install_commands=["pip install holehe"],
            capabilities=["email_enum", "account_discovery", "registration_check"],
            output_formats=["json", "csv"],
        ))
        self._register(ToolDefinition(
            name="h8mail",
            target_type=TargetType.EMAIL_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Email OSINT and breach hunting — check breaches, generate targets, chase emails",
            effectiveness=0.92,
            priority=5,
            python_package="h8mail",
            cli_command="h8mail",
            install_commands=["pip install h8mail"],
            capabilities=["breach_check", "email_chase", "pattern_generation", "api_integration"],
            output_formats=["json", "csv"],
        ))
        self._register(ToolDefinition(
            name="emailrep",
            target_type=TargetType.EMAIL_INTEL,
            tool_type=ToolType.REST_API,
            description="EmailRep API — email reputation and risk scoring based on breach and social data",
            effectiveness=0.85,
            priority=20,
            api_base_url="https://emailrep.io",
            capabilities=["reputation_check", "breach_check", "risk_scoring", "social_profiles"],
            output_formats=["json"],
            rate_limit=1.0,
        ))

    # ---- DNS Intel ----------------------------------------------------

    def _register_dns_tools(self):
        self._register(ToolDefinition(
            name="dnsx",
            target_type=TargetType.DNS_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Fast multi-purpose DNS toolkit — brute force, wildcard detection, record extraction",
            effectiveness=0.93,
            priority=10,
            cli_command="dnsx",
            install_commands=["go install -v github.com/projectdiscovery/dnsx/cmd/dnsx@latest"],
            capabilities=["dns_resolve", "brute_force", "wildcard_detection", "record_extraction",
                          "reverse_dns"],
            output_formats=["json", "txt"],
        ))
        self._register(ToolDefinition(
            name="subfinder",
            target_type=TargetType.DNS_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="Fast passive subdomain discovery using certificate transparency, DNS datasets, and APIs",
            effectiveness=0.95,
            priority=5,
            cli_command="subfinder",
            install_commands=["go install -v github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest"],
            capabilities=["subdomain_enum", "passive_recon", "cert_transparency", "api_aggregation"],
            output_formats=["json", "txt"],
            max_results_per_call=10000,
        ))
        self._register(ToolDefinition(
            name="dnsrecon",
            target_type=TargetType.DNS_INTEL,
            tool_type=ToolType.CLI_BINARY,
            description="DNS enumeration — zone transfer, brute force, SRV, cache snooping, Google dorking",
            effectiveness=0.88,
            priority=20,
            python_package="dnsrecon",
            cli_command="dnsrecon",
            install_commands=["pip install dnsrecon"],
            capabilities=["zone_transfer", "dns_brute", "srv_enum", "cache_snoop",
                          "reverse_lookup", "google_enum"],
            output_formats=["json", "csv", "xml"],
        ))
        self._register(ToolDefinition(
            name="dnstwist",
            target_type=TargetType.DNS_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Detect typosquatting, phishing, and brand impersonation via DNS permutation",
            effectiveness=0.90,
            priority=15,
            python_package="dnstwist",
            cli_command="dnstwist",
            install_commands=["pip install dnstwist"],
            capabilities=["typosquat_detection", "phishing_detection", "brand_monitoring",
                          "homoglyph_detection", "mx_check"],
            output_formats=["json", "csv"],
        ))

    # ---- Malware Intel ------------------------------------------------

    def _register_malware_tools(self):
        self._register(ToolDefinition(
            name="virustotal-api",
            target_type=TargetType.MALWARE_INTEL,
            tool_type=ToolType.REST_API,
            description="VirusTotal API — scan files/URLs/IPs against 70+ antivirus engines",
            effectiveness=0.96,
            priority=5,
            python_package="vt-py",
            install_commands=["pip install vt-py"],
            requires_auth=True,
            auth_env_vars=["VIRUSTOTAL_API_KEY"],
            auth_description="Free API key from virustotal.com (500 requests/day)",
            capabilities=["file_scan", "url_scan", "ip_lookup", "domain_lookup",
                          "hash_lookup", "behavior_analysis", "relationship_mapping"],
            output_formats=["json"],
            rate_limit=15.0,
        ))
        self._register(ToolDefinition(
            name="malwarebazaar",
            target_type=TargetType.MALWARE_INTEL,
            tool_type=ToolType.REST_API,
            description="MalwareBazaar by abuse.ch — malware sample sharing and IOC lookup",
            effectiveness=0.90,
            priority=10,
            api_base_url="https://mb-api.abuse.ch/api/v1",
            capabilities=["sample_search", "hash_lookup", "tag_search", "signature_search",
                          "recent_samples", "yara_search"],
            output_formats=["json"],
            rate_limit=1.0,
        ))
        self._register(ToolDefinition(
            name="maltrail",
            target_type=TargetType.MALWARE_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="Malicious traffic detection system using public blacklists and heuristic analysis",
            effectiveness=0.85,
            priority=20,
            python_package="maltrail",
            install_commands=["pip install maltrail"],
            capabilities=["traffic_analysis", "blacklist_check", "heuristic_detection",
                          "ip_reputation", "domain_reputation"],
            output_formats=["json"],
        ))
        self._register(ToolDefinition(
            name="yara-scanner",
            target_type=TargetType.MALWARE_INTEL,
            tool_type=ToolType.PYTHON_LIBRARY,
            description="YARA-based file and memory scanner for malware detection and classification",
            effectiveness=0.92,
            priority=15,
            python_package="yara-python",
            install_commands=["pip install yara-python"],
            capabilities=["file_scan", "memory_scan", "rule_matching", "malware_classification"],
            output_formats=["json"],
        ))
