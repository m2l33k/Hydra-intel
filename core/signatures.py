"""
HYDRA INTEL — Technology Signatures & IOC Detection Engine

Comprehensive pattern matching for:
- Leaked credentials & secrets
- Threat indicators (IOCs)
- Malware signatures
- Actor/campaign patterns
- Infrastructure fingerprints
"""

import re
import hashlib
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple, Any
from enum import Enum

from core.logger import get_logger

logger = get_logger("signatures")


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SignatureCategory(Enum):
    LEAK_PATTERN = "leak_pattern"
    THREAT_KEYWORD = "threat_keyword"
    IOC_PATTERN = "ioc_pattern"
    ACTOR_PATTERN = "actor_pattern"
    INFRASTRUCTURE = "infrastructure"
    MALWARE = "malware"
    CREDENTIAL = "credential"
    CRYPTO = "crypto"
    PII = "pii"


class SeverityLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


# ---------------------------------------------------------------------------
# Signature Match Result
# ---------------------------------------------------------------------------

@dataclass
class SignatureMatch:
    """A single signature match found in scanned content."""
    category: str
    subcategory: str
    pattern_name: str
    matched_text: str
    severity: str
    confidence: float  # 0.0 - 1.0
    context: str = ""  # surrounding text
    line_number: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "subcategory": self.subcategory,
            "pattern_name": self.pattern_name,
            "matched_text": self.matched_text[:200],
            "severity": self.severity,
            "confidence": round(self.confidence, 2),
            "context": self.context[:300],
            "line_number": self.line_number,
            "metadata": self.metadata,
        }


@dataclass
class ScanResult:
    """Result of scanning content against all signatures."""
    total_matches: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    matches: List[SignatureMatch] = field(default_factory=list)
    categories_hit: Set[str] = field(default_factory=set)
    risk_score: float = 0.0  # 0.0 - 10.0

    def to_dict(self) -> dict:
        return {
            "total_matches": self.total_matches,
            "critical_count": self.critical_count,
            "high_count": self.high_count,
            "medium_count": self.medium_count,
            "low_count": self.low_count,
            "categories_hit": list(self.categories_hit),
            "risk_score": round(self.risk_score, 2),
            "matches": [m.to_dict() for m in self.matches],
        }


# ---------------------------------------------------------------------------
# Signature Database
# ---------------------------------------------------------------------------

class SignatureDatabase:
    """
    Comprehensive signature database for threat detection.

    Contains regex patterns and keyword lists organized by category
    for scanning collected intelligence data.
    """

    def __init__(self):
        self.leak_patterns = self._initialize_leak_patterns()
        self.threat_keywords = self._initialize_threat_keywords()
        self.ioc_patterns = self._initialize_ioc_patterns()
        self.actor_patterns = self._initialize_actor_patterns()
        self.infrastructure_signatures = self._initialize_infrastructure_signatures()
        self.malware_signatures = self._initialize_malware_signatures()
        self.credential_patterns = self._initialize_credential_patterns()
        self.crypto_patterns = self._initialize_crypto_patterns()
        self.pii_patterns = self._initialize_pii_patterns()

        # Compile all regex patterns for performance
        self._compiled_patterns: Dict[str, Dict[str, re.Pattern]] = {}
        self._compile_all()

    # ------------------------------------------------------------------
    # Leak Patterns — secrets, keys, tokens
    # ------------------------------------------------------------------

    def _initialize_leak_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "aws_keys": {
                "patterns": [
                    r"AKIA[0-9A-Z]{16}",
                    r"aws_secret_access_key\s*[=:]\s*[A-Za-z0-9/+=]{40}",
                    r"aws_access_key_id\s*[=:]\s*AKIA[0-9A-Z]{16}",
                    r"ASIA[0-9A-Z]{16}",  # temporary STS keys
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.95,
                "description": "AWS Access Key or Secret Key exposure",
            },
            "gcp_keys": {
                "patterns": [
                    r"AIza[0-9A-Za-z_-]{35}",
                    r'"type"\s*:\s*"service_account"',
                    r"GOOG[\w]{10,30}",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.90,
                "description": "Google Cloud Platform API key or service account",
            },
            "azure_keys": {
                "patterns": [
                    r"AccountKey=[A-Za-z0-9+/=]{88}",
                    r"SharedAccessSignature=sig=[A-Za-z0-9%+/=]+",
                    r"DefaultEndpointsProtocol=https;AccountName=\w+;AccountKey=[A-Za-z0-9+/=]+",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.92,
                "description": "Microsoft Azure storage or access key",
            },
            "api_keys": {
                "patterns": [
                    r"api[_-]?key\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}['\"]?",
                    r"api[_-]?secret\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}['\"]?",
                    r"api[_-]?token\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}['\"]?",
                    r"access[_-]?token\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}['\"]?",
                    r"auth[_-]?token\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}['\"]?",
                    r"bearer\s+[A-Za-z0-9_\-.~+/]+=*",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.80,
                "description": "Generic API key or token exposure",
            },
            "github_tokens": {
                "patterns": [
                    r"ghp_[A-Za-z0-9]{36}",       # personal access token
                    r"gho_[A-Za-z0-9]{36}",       # OAuth
                    r"ghu_[A-Za-z0-9]{36}",       # user-to-server
                    r"ghs_[A-Za-z0-9]{36}",       # server-to-server
                    r"ghr_[A-Za-z0-9]{36}",       # refresh
                    r"github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}",  # fine-grained
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.98,
                "description": "GitHub personal access token or OAuth token",
            },
            "slack_tokens": {
                "patterns": [
                    r"xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24}",
                    r"xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-f0-9]{32}",
                    r"xoxo-[0-9]{10,13}-[A-Za-z0-9]{24,}",
                    r"xapp-[0-9]-[A-Z0-9]+-[0-9]+-[A-Za-z0-9]+",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.97,
                "description": "Slack bot or user token exposure",
            },
            "stripe_keys": {
                "patterns": [
                    r"sk_live_[0-9a-zA-Z]{24,}",
                    r"pk_live_[0-9a-zA-Z]{24,}",
                    r"rk_live_[0-9a-zA-Z]{24,}",
                    r"sk_test_[0-9a-zA-Z]{24,}",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.97,
                "description": "Stripe API key (live or test)",
            },
            "private_keys": {
                "patterns": [
                    r"-----BEGIN RSA PRIVATE KEY-----",
                    r"-----BEGIN OPENSSH PRIVATE KEY-----",
                    r"-----BEGIN DSA PRIVATE KEY-----",
                    r"-----BEGIN EC PRIVATE KEY-----",
                    r"-----BEGIN PGP PRIVATE KEY BLOCK-----",
                    r"-----BEGIN ENCRYPTED PRIVATE KEY-----",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.99,
                "description": "Private key material (RSA, SSH, DSA, EC, PGP)",
            },
            "database_urls": {
                "patterns": [
                    r"(?:mysql|postgres|postgresql|mongodb|redis|amqp|mssql)://[^\s'\"]+:[^\s'\"]+@[^\s'\"]+",
                    r"mongodb\+srv://[^\s'\"]+",
                    r"redis://:[^\s'\"]+@[^\s'\"]+",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.93,
                "description": "Database connection string with credentials",
            },
            "passwords": {
                "patterns": [
                    r"password\s*[=:]\s*['\"]?[^\s'\"]{8,}['\"]?",
                    r"passwd\s*[=:]\s*['\"]?[^\s'\"]{8,}['\"]?",
                    r"pwd\s*[=:]\s*['\"]?[^\s'\"]{8,}['\"]?",
                    r"secret\s*[=:]\s*['\"]?[^\s'\"]{8,}['\"]?",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.70,
                "description": "Hardcoded password or secret value",
            },
            "jwt_tokens": {
                "patterns": [
                    r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.95,
                "description": "JSON Web Token (JWT) exposure",
            },
            "sendgrid_keys": {
                "patterns": [
                    r"SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.97,
                "description": "SendGrid API key",
            },
            "twilio_keys": {
                "patterns": [
                    r"SK[0-9a-fA-F]{32}",
                    r"AC[0-9a-fA-F]{32}",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.85,
                "description": "Twilio Account SID or API key",
            },
            "heroku_keys": {
                "patterns": [
                    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.50,  # UUID format, lots of false positives
                "description": "Possible Heroku API key (UUID format)",
            },
            "firebase": {
                "patterns": [
                    r"[a-z0-9-]+\.firebaseio\.com",
                    r"[a-z0-9-]+\.firebaseapp\.com",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.80,
                "description": "Firebase database or app URL",
            },
        }

    # ------------------------------------------------------------------
    # Threat Keywords
    # ------------------------------------------------------------------

    def _initialize_threat_keywords(self) -> Dict[str, Dict[str, Any]]:
        return {
            "exploits": {
                "keywords": [
                    "exploit", "0day", "zero-day", "zeroday", "rce", "remote code execution",
                    "arbitrary code execution", "buffer overflow", "heap overflow",
                    "stack overflow", "use-after-free", "double free", "format string",
                    "command injection", "code injection", "sql injection", "sqli",
                    "xss", "cross-site scripting", "csrf", "ssrf", "lfi", "rfi",
                    "path traversal", "directory traversal", "deserialization",
                    "privilege escalation", "privesc", "sandbox escape",
                    "authentication bypass", "auth bypass",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.85,
            },
            "breaches": {
                "keywords": [
                    "breach", "data breach", "leak", "leaked", "dump", "dumped",
                    "exposed", "compromised", "hacked", "stolen data", "data theft",
                    "exfiltration", "data loss", "unauthorized access",
                    "credential stuffing", "combo list", "combolist",
                    "database dump", "db dump", "sql dump",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.80,
            },
            "malware": {
                "keywords": [
                    "ransomware", "stealer", "infostealer", "botnet", "trojan",
                    "backdoor", "rootkit", "keylogger", "spyware", "adware",
                    "cryptominer", "cryptojacker", "wiper", "dropper", "loader",
                    "rat", "remote access trojan", "webshell", "web shell",
                    "c2", "command and control", "c&c", "cnc",
                    "phishing kit", "exploit kit", "banker", "clipper",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.85,
            },
            "ransomware_groups": {
                "keywords": [
                    "lockbit", "blackcat", "alphv", "clop", "cl0p", "royal",
                    "black basta", "play ransomware", "bianlian", "akira",
                    "rhysida", "8base", "medusa", "noescape", "cactus",
                    "hunters international", "qilin", "inc ransom",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.90,
            },
            "attack_techniques": {
                "keywords": [
                    "lateral movement", "persistence", "initial access",
                    "credential dumping", "pass the hash", "pass the ticket",
                    "kerberoasting", "golden ticket", "silver ticket",
                    "dcsync", "lsass dump", "mimikatz", "bloodhound",
                    "cobalt strike", "beacon", "meterpreter", "empire",
                    "powershell empire", "covenant", "sliver",
                    "dll injection", "process injection", "reflective loading",
                    "living off the land", "lolbins", "lolbas",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.88,
            },
            "infrastructure_attacks": {
                "keywords": [
                    "ddos", "denial of service", "distributed denial",
                    "dns poisoning", "dns hijacking", "bgp hijack",
                    "arp spoofing", "man in the middle", "mitm",
                    "supply chain attack", "dependency confusion",
                    "typosquatting", "watering hole",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.82,
            },
            "dark_web_markets": {
                "keywords": [
                    "darknet market", "dark web market", "underground forum",
                    "carding", "fullz", "cvv", "dumps", "accounts for sale",
                    "access for sale", "initial access broker", "iab",
                    "ransomware as a service", "raas", "maas",
                    "malware as a service", "ddos for hire", "booter",
                    "stresser",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.85,
            },
        }

    # ------------------------------------------------------------------
    # IOC Patterns
    # ------------------------------------------------------------------

    def _initialize_ioc_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "ipv4": {
                "patterns": [
                    r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.70,
                "description": "IPv4 address",
                "exclude": ["127.0.0.1", "0.0.0.0", "255.255.255.255", "192.168.", "10.", "172.16."],
            },
            "ipv6": {
                "patterns": [
                    r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b",
                    r"\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.65,
                "description": "IPv6 address",
            },
            "domain": {
                "patterns": [
                    r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|info|biz|xyz|top|ru|cn|tk|ml|ga|cf|gq|onion|i2p)\b",
                ],
                "severity": SeverityLevel.LOW,
                "confidence": 0.60,
                "description": "Domain name (potentially malicious TLDs highlighted)",
            },
            "onion_domain": {
                "patterns": [
                    r"\b[a-z2-7]{16}\.onion\b",
                    r"\b[a-z2-7]{56}\.onion\b",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.95,
                "description": "Tor .onion hidden service address",
            },
            "url": {
                "patterns": [
                    r"https?://[^\s<>\"']+",
                ],
                "severity": SeverityLevel.LOW,
                "confidence": 0.50,
                "description": "HTTP/HTTPS URL",
            },
            "md5_hash": {
                "patterns": [
                    r"\b[a-fA-F0-9]{32}\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.60,
                "description": "MD5 hash (possible IOC)",
            },
            "sha1_hash": {
                "patterns": [
                    r"\b[a-fA-F0-9]{40}\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.65,
                "description": "SHA-1 hash (possible IOC)",
            },
            "sha256_hash": {
                "patterns": [
                    r"\b[a-fA-F0-9]{64}\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.70,
                "description": "SHA-256 hash (possible IOC)",
            },
            "email_address": {
                "patterns": [
                    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
                ],
                "severity": SeverityLevel.LOW,
                "confidence": 0.80,
                "description": "Email address",
            },
            "cve_id": {
                "patterns": [
                    r"\bCVE-\d{4}-\d{4,}\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.99,
                "description": "CVE identifier",
            },
            "mitre_attack_id": {
                "patterns": [
                    r"\b[TS]\d{4}(?:\.\d{3})?\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.85,
                "description": "MITRE ATT&CK technique/sub-technique ID",
            },
        }

    # ------------------------------------------------------------------
    # Actor Patterns
    # ------------------------------------------------------------------

    def _initialize_actor_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "apt_groups": {
                "keywords": [
                    "APT28", "APT29", "APT38", "APT41", "Fancy Bear", "Cozy Bear",
                    "Lazarus", "Lazarus Group", "Equation Group", "Turla",
                    "Sandworm", "Gamaredon", "Kimsuky", "Charming Kitten",
                    "OilRig", "MuddyWater", "Stone Panda", "Gothic Panda",
                    "Volt Typhoon", "Salt Typhoon", "Midnight Blizzard",
                    "Star Blizzard", "Forest Blizzard", "Peach Sandstorm",
                    "Ember Bear", "Cadet Blizzard", "Aqua Blizzard",
                    "FIN7", "FIN8", "FIN11", "FIN12",
                    "UNC2452", "UNC3886", "UNC4736",
                    "Scattered Spider", "LAPSUS$",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.95,
            },
            "nation_state": {
                "keywords": [
                    "nation state", "state-sponsored", "state sponsored",
                    "chinese hacker", "russian hacker", "north korean hacker",
                    "iranian hacker", "cyber espionage", "cyber warfare",
                    "information warfare", "cyber operation",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.80,
            },
            "cybercrime_groups": {
                "keywords": [
                    "cybercrime group", "threat group", "threat actor",
                    "hacker group", "hacking crew", "cartel",
                    "initial access broker", "ransomware gang",
                    "bulletproof hosting", "money mule",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.75,
            },
            "campaigns": {
                "keywords": [
                    "campaign", "operation", "attack wave",
                    "mass exploitation", "spray and pray",
                    "targeted attack", "spear phishing campaign",
                    "watering hole campaign",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.65,
            },
        }

    # ------------------------------------------------------------------
    # Infrastructure Signatures
    # ------------------------------------------------------------------

    def _initialize_infrastructure_signatures(self) -> Dict[str, Dict[str, Any]]:
        return {
            "c2_indicators": {
                "patterns": [
                    r"(?:cobalt\s*strike|cobaltstrike)\s*(?:beacon|listener|stager)",
                    r"(?:meterpreter|metasploit)\s*(?:session|payload|handler)",
                    r"(?:empire|covenant|sliver|brute\s*ratel|havoc)\s*(?:agent|listener|implant)",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.90,
                "description": "Command & Control framework indicators",
            },
            "webshell_indicators": {
                "patterns": [
                    r"(?:eval|exec|system|passthru|shell_exec)\s*\(\s*\$_(GET|POST|REQUEST|COOKIE)",
                    r"<%\s*(?:eval|execute)\s*request",
                    r"Runtime\.getRuntime\(\)\.exec\(",
                    r"ProcessBuilder\s*\(",
                    r"os\.(?:system|popen|exec)\s*\(",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.88,
                "description": "Web shell code patterns",
            },
            "port_patterns": {
                "patterns": [
                    r"port\s*(?:4444|5555|8888|1337|31337|6667|6697|9050|9051)\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.60,
                "description": "Suspicious port numbers commonly used by malware",
            },
        }

    # ------------------------------------------------------------------
    # Malware Signatures
    # ------------------------------------------------------------------

    def _initialize_malware_signatures(self) -> Dict[str, Dict[str, Any]]:
        return {
            "obfuscation": {
                "patterns": [
                    r"(?:eval|exec)\s*\(\s*(?:base64_decode|atob|fromCharCode)\s*\(",
                    r"\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}",
                    r"String\.fromCharCode\(\d+(?:,\s*\d+){10,}\)",
                    r"(?:chr|char)\(\d+\)\.(?:chr|char)\(\d+\)",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.80,
                "description": "Code obfuscation techniques common in malware",
            },
            "persistence_mechanisms": {
                "patterns": [
                    r"HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    r"HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
                    r"/etc/cron\.",
                    r"schtasks\s*/create",
                    r"systemctl\s*enable",
                    r"launchctl\s*load",
                    r"@reboot\s+",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.85,
                "description": "OS persistence mechanisms (registry, cron, scheduled tasks)",
            },
            "data_exfil": {
                "patterns": [
                    r"curl\s+.*-d\s+@",
                    r"wget\s+--post-file",
                    r"certutil\s+-urlcache",
                    r"bitsadmin\s*/transfer",
                    r"Invoke-WebRequest.*-OutFile",
                    r"dns\s*tunnel|dns\s*exfil",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.82,
                "description": "Data exfiltration techniques",
            },
        }

    # ------------------------------------------------------------------
    # Credential Patterns
    # ------------------------------------------------------------------

    def _initialize_credential_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "username_password_pairs": {
                "patterns": [
                    r"(?:user(?:name)?|login)\s*[=:]\s*\S+\s*(?:pass(?:word)?|pwd)\s*[=:]\s*\S+",
                    r"\b\S+@\S+\.\S+\s*[:|]\s*\S{6,}",  # email:password format
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.75,
                "description": "Username/password pairs in cleartext",
            },
            "hash_dumps": {
                "patterns": [
                    r"\b\w+:\d+:[a-fA-F0-9]{32}:[a-fA-F0-9]{32}:::\b",  # NTLM
                    r"\$[1256][ay]?\$[^\s:]+\$[A-Za-z0-9./+]+",  # Unix crypt
                    r"\$2[aby]?\$\d{1,2}\$[A-Za-z0-9./]{53}",  # bcrypt
                    r"\$argon2i[d]?\$[^\s]+",  # Argon2
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.90,
                "description": "Password hash dump (NTLM, Unix, bcrypt, Argon2)",
            },
            "ssh_credentials": {
                "patterns": [
                    r"ssh\s+(?:-i\s+\S+\s+)?\w+@[\d.]+",
                    r"sshpass\s+-p\s+\S+",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.85,
                "description": "SSH connection with credentials",
            },
        }

    # ------------------------------------------------------------------
    # Crypto Patterns (wallets, transactions)
    # ------------------------------------------------------------------

    def _initialize_crypto_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "bitcoin_address": {
                "patterns": [
                    r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b",
                    r"\bbc1[a-z0-9]{25,90}\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.80,
                "description": "Bitcoin wallet address",
            },
            "ethereum_address": {
                "patterns": [
                    r"\b0x[0-9a-fA-F]{40}\b",
                ],
                "severity": SeverityLevel.MEDIUM,
                "confidence": 0.85,
                "description": "Ethereum wallet address",
            },
            "monero_address": {
                "patterns": [
                    r"\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.90,
                "description": "Monero wallet address (privacy coin, often used in ransomware)",
            },
            "crypto_ransom": {
                "patterns": [
                    r"(?:send|transfer|pay)\s+(?:\d+\.?\d*)\s*(?:btc|bitcoin|eth|ethereum|xmr|monero)",
                    r"(?:bitcoin|btc|eth|xmr)\s*(?:wallet|address)\s*[=:]\s*\S+",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.88,
                "description": "Cryptocurrency ransom demand or payment instruction",
            },
        }

    # ------------------------------------------------------------------
    # PII Patterns
    # ------------------------------------------------------------------

    def _initialize_pii_patterns(self) -> Dict[str, Dict[str, Any]]:
        return {
            "ssn": {
                "patterns": [
                    r"\b\d{3}-\d{2}-\d{4}\b",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.70,
                "description": "US Social Security Number",
            },
            "credit_card": {
                "patterns": [
                    r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b",
                ],
                "severity": SeverityLevel.CRITICAL,
                "confidence": 0.85,
                "description": "Credit card number (Visa, Mastercard, Amex, Discover)",
            },
            "phone_number": {
                "patterns": [
                    r"\b\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b",
                ],
                "severity": SeverityLevel.LOW,
                "confidence": 0.50,
                "description": "US phone number",
            },
            "passport": {
                "patterns": [
                    r"\b[A-Z]{1,2}[0-9]{6,9}\b",
                ],
                "severity": SeverityLevel.HIGH,
                "confidence": 0.40,
                "description": "Possible passport number",
            },
        }

    # ------------------------------------------------------------------
    # Compile all patterns
    # ------------------------------------------------------------------

    def _compile_all(self):
        """Pre-compile all regex patterns for performance."""
        all_categories = {
            "leak_patterns": self.leak_patterns,
            "ioc_patterns": self.ioc_patterns,
            "infrastructure": self.infrastructure_signatures,
            "malware": self.malware_signatures,
            "credential": self.credential_patterns,
            "crypto": self.crypto_patterns,
            "pii": self.pii_patterns,
        }
        for cat_name, cat_data in all_categories.items():
            self._compiled_patterns[cat_name] = {}
            for pattern_name, pattern_info in cat_data.items():
                compiled = []
                for p in pattern_info.get("patterns", []):
                    try:
                        compiled.append(re.compile(p, re.IGNORECASE))
                    except re.error as e:
                        logger.warning("Failed to compile pattern '%s' in %s/%s: %s",
                                      p, cat_name, pattern_name, e)
                self._compiled_patterns[cat_name][pattern_name] = compiled

    def get_compiled(self, category: str, pattern_name: str) -> List[re.Pattern]:
        return self._compiled_patterns.get(category, {}).get(pattern_name, [])


# ---------------------------------------------------------------------------
# Signature Scanner
# ---------------------------------------------------------------------------

class SignatureScanner:
    """
    Scans text content against the full signature database.

    Usage:
        scanner = SignatureScanner()
        result = scanner.scan("Found AKIA1234567890123456 in leaked file")
        print(result.risk_score)  # 8.5
    """

    def __init__(self, db: Optional[SignatureDatabase] = None):
        self.db = db or SignatureDatabase()
        self._max_matches_per_scan = 500

    def scan(self, content: str, categories: Optional[List[str]] = None) -> ScanResult:
        """
        Scan content against all (or selected) signature categories.

        Args:
            content: Text to scan
            categories: Optional filter — only scan these categories
        """
        if not content:
            return ScanResult()

        result = ScanResult()
        lines = content.split("\n")

        # Scan regex-based patterns
        self._scan_regex_patterns(content, lines, result, categories)

        # Scan keyword-based patterns
        self._scan_keywords(content, result, categories)

        # Calculate risk score
        result.risk_score = self._calculate_risk_score(result)

        return result

    def scan_intel_record(self, record: dict) -> ScanResult:
        """Scan an intel record (title + content + metadata)."""
        parts = []
        if record.get("title"):
            parts.append(record["title"])
        if record.get("content"):
            parts.append(record["content"])
        if record.get("url"):
            parts.append(record["url"])
        if record.get("metadata"):
            meta = record["metadata"]
            if isinstance(meta, dict):
                parts.append(str(meta))
            elif isinstance(meta, str):
                parts.append(meta)

        combined = "\n".join(parts)
        return self.scan(combined)

    def scan_batch(self, records: List[dict]) -> List[Tuple[dict, ScanResult]]:
        """Scan a batch of intel records."""
        results = []
        for record in records:
            scan_result = self.scan_intel_record(record)
            results.append((record, scan_result))
        return results

    # ------------------------------------------------------------------
    # Internal scanning
    # ------------------------------------------------------------------

    def _scan_regex_patterns(
        self,
        content: str,
        lines: List[str],
        result: ScanResult,
        categories: Optional[List[str]],
    ):
        """Scan all regex-based pattern categories."""
        cats_to_scan = {
            "leak_patterns": (self.db.leak_patterns, SignatureCategory.LEAK_PATTERN.value),
            "ioc_patterns": (self.db.ioc_patterns, SignatureCategory.IOC_PATTERN.value),
            "infrastructure": (self.db.infrastructure_signatures, SignatureCategory.INFRASTRUCTURE.value),
            "malware": (self.db.malware_signatures, SignatureCategory.MALWARE.value),
            "credential": (self.db.credential_patterns, SignatureCategory.CREDENTIAL.value),
            "crypto": (self.db.crypto_patterns, SignatureCategory.CRYPTO.value),
            "pii": (self.db.pii_patterns, SignatureCategory.PII.value),
        }

        for cat_key, (cat_data, cat_label) in cats_to_scan.items():
            if categories and cat_key not in categories:
                continue

            for pattern_name, pattern_info in cat_data.items():
                compiled_patterns = self.db.get_compiled(cat_key, pattern_name)
                severity = pattern_info.get("severity", SeverityLevel.MEDIUM)
                confidence = pattern_info.get("confidence", 0.5)
                excludes = pattern_info.get("exclude", [])

                for regex in compiled_patterns:
                    for match in regex.finditer(content):
                        matched_text = match.group()

                        # Check exclusions
                        if any(exc in matched_text for exc in excludes):
                            continue

                        # Find line number
                        pos = match.start()
                        line_num = content[:pos].count("\n") + 1

                        # Get context
                        ctx_start = max(0, pos - 100)
                        ctx_end = min(len(content), match.end() + 100)
                        context = content[ctx_start:ctx_end].strip()

                        result.matches.append(SignatureMatch(
                            category=cat_label,
                            subcategory=cat_key,
                            pattern_name=pattern_name,
                            matched_text=matched_text,
                            severity=severity.value if isinstance(severity, SeverityLevel) else severity,
                            confidence=confidence,
                            context=context,
                            line_number=line_num,
                        ))

                        result.total_matches += 1
                        result.categories_hit.add(cat_label)

                        sev = severity.value if isinstance(severity, SeverityLevel) else severity
                        if sev == "critical":
                            result.critical_count += 1
                        elif sev == "high":
                            result.high_count += 1
                        elif sev == "medium":
                            result.medium_count += 1
                        elif sev == "low":
                            result.low_count += 1

                        if result.total_matches >= self._max_matches_per_scan:
                            return

    def _scan_keywords(
        self,
        content: str,
        result: ScanResult,
        categories: Optional[List[str]],
    ):
        """Scan keyword-based categories (threat keywords, actor patterns)."""
        content_lower = content.lower()

        keyword_cats = {
            "threat_keywords": (self.db.threat_keywords, SignatureCategory.THREAT_KEYWORD.value),
            "actor_patterns": (self.db.actor_patterns, SignatureCategory.ACTOR_PATTERN.value),
        }

        for cat_key, (cat_data, cat_label) in keyword_cats.items():
            if categories and cat_key not in categories:
                continue

            for group_name, group_info in cat_data.items():
                keywords = group_info.get("keywords", [])
                severity = group_info.get("severity", SeverityLevel.MEDIUM)
                confidence = group_info.get("confidence", 0.5)

                for keyword in keywords:
                    kw_lower = keyword.lower()
                    idx = content_lower.find(kw_lower)
                    if idx >= 0:
                        # Get context
                        ctx_start = max(0, idx - 80)
                        ctx_end = min(len(content), idx + len(keyword) + 80)
                        context = content[ctx_start:ctx_end].strip()
                        line_num = content[:idx].count("\n") + 1

                        result.matches.append(SignatureMatch(
                            category=cat_label,
                            subcategory=cat_key,
                            pattern_name=group_name,
                            matched_text=keyword,
                            severity=severity.value if isinstance(severity, SeverityLevel) else severity,
                            confidence=confidence,
                            context=context,
                            line_number=line_num,
                        ))

                        result.total_matches += 1
                        result.categories_hit.add(cat_label)

                        sev = severity.value if isinstance(severity, SeverityLevel) else severity
                        if sev == "critical":
                            result.critical_count += 1
                        elif sev == "high":
                            result.high_count += 1
                        elif sev == "medium":
                            result.medium_count += 1
                        elif sev == "low":
                            result.low_count += 1

                        if result.total_matches >= self._max_matches_per_scan:
                            return

    def _calculate_risk_score(self, result: ScanResult) -> float:
        """Calculate a 0-10 risk score based on matches."""
        if result.total_matches == 0:
            return 0.0

        score = 0.0
        score += result.critical_count * 3.0
        score += result.high_count * 2.0
        score += result.medium_count * 1.0
        score += result.low_count * 0.3

        # Bonus for category diversity
        score += len(result.categories_hit) * 0.5

        # Weight by average confidence
        if result.matches:
            avg_confidence = sum(m.confidence for m in result.matches) / len(result.matches)
            score *= avg_confidence

        return min(10.0, score)
