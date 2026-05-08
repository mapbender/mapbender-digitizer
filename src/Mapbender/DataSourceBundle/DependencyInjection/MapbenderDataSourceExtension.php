<?php

namespace Mapbender\DataSourceBundle\DependencyInjection;

use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Extension\PrependExtensionInterface;

/**
 * DI Extension for DataSourceBundle — registers PostGIS type mappings for Doctrine.
 *
 * WHY THIS EXISTS
 * ===============
 * Doctrine DBAL does not know about PostGIS column types (geometry, geography, etc.).
 * When Doctrine's SchemaManager introspects a PostgreSQL table that has a `geometry`
 * column, it throws:
 *
 *     "Unknown database type geometry requested, Doctrine\DBAL\Platforms\PostgreSQL120Platform
 *      may not support it."
 *
 * This error typically occurs during:
 *   - Schema introspection (e.g., `SchemaManager::listTableColumns()`)
 *   - Doctrine migrations
 *   - Any code that reads the database schema metadata
 *
 * NOTE ON HISTORICAL BEHAVIOR
 * ===========================
 * In many Mapbender setups, this error never appeared because the application code
 * was not triggering Doctrine schema introspection on geodata tables. The old
 * FeatureType/DataStore code built raw SQL directly without asking Doctrine about
 * column types. The error surfaces when:
 *   - The DiscreteColumnAdapter calls `SchemaManager::listTableColumns()` to auto-detect fields
 *   - Doctrine migrations or commands inspect the geodata_db connection
 *   - Debug tools (e.g., Symfony profiler) introspect the database schema
 *
 * So while "everything worked before", it was only because the code path that
 * triggers introspection was not exercised. The new PropertyAdapter architecture
 * DOES call `listTableColumns()` for auto-detection, making this fix necessary.
 *
 * HOW IT WORKS
 * ============
 * This extension uses Symfony's PrependExtensionInterface to inject `mapping_types`
 * into DoctrineBundle's DBAL configuration at container compile time. This is
 * equivalent to manually adding the following to doctrine.yaml for each connection:
 *
 *     doctrine:
 *         dbal:
 *             connections:
 *                 geodata_db:
 *                     mapping_types:
 *                         geometry: string
 *                         geography: string
 *
 * The mapping tells Doctrine: "when you encounter a column of type 'geometry' in the
 * database, treat it as a 'string' in the DBAL type system." This is safe because:
 *
 *   1. FeatureType handles geometry as EWKT text strings (via ST_AsEWKT / ST_GeomFromEWKT)
 *   2. The DBAL type only matters for schema introspection, not for actual data read/write
 *   3. Non-PostgreSQL connections silently ignore mapping types for columns they don't have
 *
 * The mapping is applied to ALL declared Doctrine connections (not just geodata_db)
 * because any connection might point to a PostGIS-enabled database, and the mappings
 * are harmless for non-PostGIS databases.
 *
 * WHY NOT JUST USE doctrine.yaml?
 * ===============================
 * Adding `mapping_types` manually to doctrine.yaml works, but:
 *   - Every project using DataSourceBundle would need to add it manually
 *   - New PostGIS types (geography, box2d) would need manual additions
 *   - It's easy to forget after initial setup
 *   - The bundle should be self-contained: if you install it, it should work
 *
 * This extension ensures any project using DataSourceBundle gets PostGIS type
 * support automatically, without manual doctrine.yaml configuration.
 */
class MapbenderDataSourceExtension extends Extension implements PrependExtensionInterface
{
    /**
     * PostGIS types that Doctrine does not know natively.
     * Mapped to DBAL 'string' for schema introspection only.
     *
     * These are the standard PostGIS types that may appear as column types
     * when introspecting a PostgreSQL/PostGIS database. Doctrine's
     * PostgreSQLPlatform does not include them in its type mapping.
     */
    private const POSTGIS_TYPE_MAPPINGS = [
        'geometry'      => 'string',   // Most common: geometry(Point,4326), geometry, etc.
        'geography'     => 'string',   // Geography type (uses geodesic calculations)
        'box2d'         => 'string',   // PostGIS 2D bounding box
        'box3d'         => 'string',   // PostGIS 3D bounding box
    ];

    /**
     * Prepends PostGIS type mappings into DoctrineBundle's configuration for
     * all declared connections. Runs at container compile time.
     */
    public function prepend(ContainerBuilder $container): void
    {
        if (!$container->hasExtension('doctrine')) {
            return;
        }

        $connectionNames = $this->collectConnectionNames($container);

        $connectionsConfig = [];
        foreach ($connectionNames as $name) {
            $connectionsConfig[$name] = [
                'mapping_types' => self::POSTGIS_TYPE_MAPPINGS,
            ];
        }

        $container->prependExtensionConfig('doctrine', [
            'dbal' => [
                'connections' => $connectionsConfig,
            ],
        ]);
    }

    public function load(array $configs, ContainerBuilder $container): void
    {
        // DataSourceBundle has no user-facing bundle configuration.
        // Service definitions are loaded in MapbenderDataSourceBundle::build().
    }

    /**
     * Collects all connection names from existing doctrine configuration blocks.
     * Falls back to ['default'] if no connections are explicitly defined
     * (covers the case where DoctrineBundle is configured with only a default url).
     *
     * @return string[]
     */
    private function collectConnectionNames(ContainerBuilder $container): array
    {
        $names = [];
        foreach ($container->getExtensionConfig('doctrine') as $config) {
            if (isset($config['dbal']['connections']) && is_array($config['dbal']['connections'])) {
                foreach (array_keys($config['dbal']['connections']) as $name) {
                    $names[$name] = true;
                }
            }
        }

        return !empty($names) ? array_keys($names) : ['default'];
    }
}
