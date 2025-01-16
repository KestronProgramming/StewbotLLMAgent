wg genkey > privatekey
Get-Content privatekey | wg pubkey | Set-Content publickey