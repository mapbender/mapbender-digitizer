<?php


namespace Mapbender\DataSourceBundle\Component;


use Symfony\Component\Security\Core\Authentication\Token\NullToken;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;

/**
 * @todo: stop using eval already
 */
class EventProcessor
{
    public $allowSave = true;
    public $allowUpdate = true;
    public $allowInsert = true;
    public $allowRemove = true;

    public function __construct(
        protected AuthorizationCheckerInterface $authorizationChecker,
        protected TokenStorageInterface         $tokenStorage
    )
    {
    }

    public function runExpression($expression, array $locals)
    {
        $this->reset();
        // ~extract
        foreach ($this->addBuiltins($locals) as $key => &$value) {
            ${$key} = &$value;
        }
        $return = eval($expression);
        if ($return === false && ($errorDetails = error_get_last())) {
            $lastError = end($errorDetails);
            throw new \Exception($lastError["message"], $lastError["type"]);
        }
    }

    /**
     * For eval events only.
     */
    protected function preventSave()
    {
        $this->allowSave = false;
    }

    /**
     * For eval events only.
     */
    protected function preventRemove()
    {
        $this->allowRemove = false;
    }

    protected function reset()
    {
        $this->allowUpdate = true;
        $this->allowSave = true;
        $this->allowInsert = true;
        $this->allowRemove = true;
    }

    /**
     * @param array $locals
     * @return array
     */
    protected function addBuiltins(array $locals)
    {
        $token = $this->tokenStorage->getToken();

        $locals += array(
            'context' => $this->authorizationChecker,
            'tokenStorage' => $this->tokenStorage,
            'user' => ($token !== null && !$token instanceof NullToken) ? $token->getUser() : null,
            'userRoles' => array(),
        );

        if ($token !== null && !$token instanceof NullToken) {
            $token = $this->tokenStorage->getToken();
            $locals['userRoles'] = $token->getRoleNames();
        }
        return $locals;
    }
}
