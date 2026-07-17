<?php

/**
 * Intercambia un token opaco de MOVI por credenciales IMAP mediante un canal
 * servidor-a-servidor. El token es de un solo uso y la contraseña nunca llega
 * al navegador.
 */
class movi_sso extends rcube_plugin
{
    public $task = 'login';
    private ?array $credentials = null;

    #[\Override]
    public function init()
    {
        $this->add_hook('startup', [$this, 'startup']);
        $this->add_hook('authenticate', [$this, 'authenticate']);
    }

    public function startup($args)
    {
        if (empty($_SESSION['user_id']) && $this->token()) {
            $args['action'] = 'login';
        }

        return $args;
    }

    public function authenticate($args)
    {
        $token = $this->token();
        if (!$token) {
            return $args;
        }

        $credentials = $this->redeem($token);
        if (!$credentials) {
            $args['valid'] = false;
            return $args;
        }

        $args['user'] = $credentials['username'];
        $args['pass'] = $credentials['password'];
        $args['host'] = $credentials['host'];
        $args['cookiecheck'] = false;
        $args['valid'] = true;

        return $args;
    }

    private function token(): ?string
    {
        $token = rcube_utils::get_input_string('_movi_token', rcube_utils::INPUT_GET);
        return is_string($token) && preg_match('/^[A-Za-z0-9_-]{43}$/', $token) ? $token : null;
    }

    private function redeem(string $token): ?array
    {
        if ($this->credentials !== null) {
            return $this->credentials;
        }

        $url = getenv('ROUNDCUBE_SSO_REDEEM_URL') ?: '';
        $secret = getenv('ROUNDCUBE_SSO_SHARED_SECRET') ?: '';
        if (!$url || !$secret || !str_starts_with($url, 'https://')) {
            return null;
        }

        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['token' => $token], JSON_THROW_ON_ERROR),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-Movi-Roundcube-Secret: ' . $secret,
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if ($status !== 200 || !is_string($body)) {
            return null;
        }

        try {
            $data = json_decode($body, true, 8, JSON_THROW_ON_ERROR);
        } catch (Throwable $error) {
            return null;
        }

        if (
            !is_array($data)
            || !filter_var($data['username'] ?? '', FILTER_VALIDATE_EMAIL)
            || !is_string($data['password'] ?? null)
            || !is_string($data['host'] ?? null)
        ) {
            return null;
        }

        $this->credentials = $data;
        return $this->credentials;
    }
}
