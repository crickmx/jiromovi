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
        $this->add_hook('login_after', [$this, 'loginAfter']);
    }

    public function startup($args)
    {
        $token = $this->token();
        if (!$token) {
            return $args;
        }

        if (empty($_SESSION['user_id'])) {
            $args['action'] = 'login';
            return $args;
        }

        // Una sesión de Roundcube puede seguir abierta durante días. Cada
        // handoff desde MOVI debe volver a aplicar la identidad, la firma y los
        // contactos actuales, incluso cuando no ocurre un login IMAP nuevo.
        $credentials = $this->redeem($token);
        $rcmail = rcmail::get_instance();
        $currentUsername = strtolower((string) $rcmail->user->get_username());
        $requestedUsername = strtolower((string) ($credentials['username'] ?? ''));

        if ($credentials && $currentUsername && hash_equals($currentUsername, $requestedUsername)) {
            $this->syncIdentityAndContacts($rcmail);
        } elseif ($credentials) {
            // Si MOVI cambió de usuario, no se debe conservar la sesión IMAP
            // anterior. Las credenciales ya canjeadas permanecen en memoria y
            // el hook authenticate completa el login de la cuenta correcta.
            $rcmail->logout_actions();
            $rcmail->kill_session();
            $args['action'] = 'login';
        }

        return $args;
    }

    public function loginAfter($args)
    {
        if (!$this->credentials || empty($this->credentials['identity'])) {
            return $args;
        }

        $rcmail = rcmail::get_instance();
        $this->syncIdentityAndContacts($rcmail);

        return $args;
    }

    private function syncIdentityAndContacts(rcmail $rcmail): void
    {
        if (!$this->credentials || empty($this->credentials['identity'])) {
            return;
        }

        $identityData = $this->credentials['identity'];
        $identity = $rcmail->user->get_identity();
        if (!$identity || empty($identity['identity_id'])) {
            return;
        }

        $rcmail->user->update_identity((int) $identity['identity_id'], [
            'name' => $identityData['name'],
            'organization' => $identityData['organization'],
            'signature' => $identityData['signature'],
            'html_signature' => 1,
            'standard' => 1,
        ]);

        $this->syncContacts($rcmail, $this->credentials['contacts'] ?? []);
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
            || !is_array($data['identity'] ?? null)
            || !is_string($data['identity']['name'] ?? null)
            || !is_string($data['identity']['organization'] ?? null)
            || !is_string($data['identity']['signature'] ?? null)
            || strlen($data['identity']['signature']) > 100000
            || !is_array($data['contacts'] ?? null)
            || count($data['contacts']) > 5000
        ) {
            return null;
        }

        foreach ($data['contacts'] as $contact) {
            if (
                !is_array($contact)
                || !in_array($contact['source'] ?? '', ['directory', 'shared'], true)
                || !is_string($contact['id'] ?? null)
                || !is_string($contact['name'] ?? null)
                || !filter_var($contact['email'] ?? '', FILTER_VALIDATE_EMAIL)
            ) {
                return null;
            }
        }

        $this->credentials = $data;
        return $this->credentials;
    }

    private function syncContacts(rcmail $rcmail, array $contacts): void
    {
        try {
            $book = $rcmail->get_address_book('sql', true);
            if (!$book) {
                return;
            }

            $managedGroups = [
                'directory' => 'MOVI — Directorio',
                'shared' => 'MOVI — Compartidos',
            ];

            // Eliminar únicamente contactos de grupos administrados. La libreta
            // personal y sus grupos nunca son modificados por la sincronización.
            foreach ($book->list_groups() as $group) {
                $source = array_search($group['name'] ?? '', $managedGroups, true);
                if ($source === false) {
                    continue;
                }

                $book->set_group($group['ID']);
                $book->set_pagesize(5000);
                $members = $book->list_records(['ID'], 5000, true);
                $ids = [];
                foreach ($members->records ?? [] as $member) {
                    if (!empty($member['ID'])) {
                        $ids[] = $member['ID'];
                    }
                }
                $book->set_group(null);
                if ($ids) {
                    $book->delete($ids, true);
                }
                $book->delete_group($group['ID']);
            }

            $groups = [];
            foreach ($managedGroups as $source => $name) {
                $created = $book->create_group($name);
                if (!empty($created['id'])) {
                    $groups[$source] = $created['id'];
                }
            }

            foreach ($contacts as $contact) {
                $source = $contact['source'];
                if (empty($groups[$source])) {
                    continue;
                }

                $record = [
                    'name' => mb_substr(trim($contact['name']), 0, 128),
                    'firstname' => mb_substr(trim($contact['firstname'] ?? ''), 0, 64),
                    'surname' => mb_substr(trim($contact['surname'] ?? ''), 0, 64),
                    'email:work' => [strtolower(trim($contact['email']))],
                    'phone:work' => [mb_substr(trim($contact['phone'] ?? ''), 0, 40)],
                    'organization' => mb_substr(trim($contact['organization'] ?? ''), 0, 128),
                    'jobtitle' => mb_substr(trim($contact['jobtitle'] ?? ''), 0, 128),
                    'notes' => 'Administrado por MOVI',
                ];
                $record = array_filter($record, static fn($value) => $value !== '' && $value !== ['']);
                $contactId = $book->insert($record);
                if ($contactId) {
                    $book->add_to_group($groups[$source], $contactId);
                }
            }
        } catch (Throwable $error) {
            rcube::raise_error([
                'code' => 600,
                'type' => 'php',
                'file' => __FILE__,
                'line' => __LINE__,
                'message' => 'MOVI contact sync failed: ' . $error->getMessage(),
            ], true, false);
        }
    }
}
