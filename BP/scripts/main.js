import { world, system, MolangVariableMap, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";

// Register custom command: /footsteps:trail on|off
system.beforeEvents.startup.subscribe((event) => {
    const registry = event.customCommandRegistry;

    registry.registerCommand(
        {
            name: "footsteps:trail",
            description: "Toggle footstep trails",
            permissionLevel: CommandPermissionLevel.Any,
            mandatoryParameters: [
                {
                    name: "state",
                    type: CustomCommandParamType.String
                }
            ]
        },
        (origin, state) => {
            const player = origin.entity || origin.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;

            // 'state' comes in as the first argument after origin
            const action = state.toLowerCase();

            if (action === "on") {
                system.run(() => {
                    player.setDynamicProperty("footsteps:enabled", true);
                    player.sendMessage("§aFootsteps trail enabled!");
                });
            } else if (action === "off") {
                system.run(() => {
                    player.setDynamicProperty("footsteps:enabled", false);
                    player.sendMessage("§cFootsteps trail disabled.");
                });
            } else {
                system.run(() => {
                    player.sendMessage("§cUsage: /footsteps:trail <on|off>");
                });
            }
        }
    );
});


// Logic to track movement and spawn particles
const lastPosMap = new Map();

// Cleanup when player leaves
world.afterEvents.playerLeave.subscribe((event) => {
    lastPosMap.delete(event.playerId);
});

system.runInterval(() => {
    const players = world.getAllPlayers();

    for (const player of players) {
        // Check if trail is enabled
        const isEnabled = player.getDynamicProperty("footsteps:enabled");
        if (!isEnabled) {
            lastPosMap.delete(player.id);
            continue;
        }

        const currentPos = player.location;
        const lastPos = lastPosMap.get(player.id);

        // Distance check: spawn a dot every 0.5 blocks of movement
        // Also ensure they are on the ground (roughly)
        if (!lastPos || distance(currentPos, lastPos) > 0.5) {
            // Only spawn if player is on ground (approximate check)
            // In a more complex version, we'd check blocks below, 
            // but for simplicity we spawn at feet.

            spawnFootstep(player, currentPos);
            lastPosMap.set(player.id, { x: currentPos.x, y: currentPos.y, z: currentPos.z });
        }
    }
}, 2); // Run every 2 ticks (approx 10 times per second)

/**
 * Spawns a particle at the specified location
 */
function spawnFootstep(player, location) {
    const vars = new MolangVariableMap();

    // Generate color from player name
    const color = stringToColor(player.name);
    vars.setColorRGBA("variable.color", color);

    // Spawn slightly above floor level to avoid z-fighting/clipping
    try {
        player.dimension.spawnParticle("footsteps:trail_dot", {
            x: location.x,
            y: location.y + 0.05,
            z: location.z
        }, vars);
    } catch { }
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert to RGB (0-1 range)
    // Use bitwise ops to extract bytes, then normalize
    const r = ((hash >> 16) & 0xFF) / 255;
    const g = ((hash >> 8) & 0xFF) / 255;
    const b = (hash & 0xFF) / 255;

    return { red: r, green: g, blue: b, alpha: 1 };
}

/**
 * Utility: distance between two 3D points
 */
function distance(p1, p2) {
    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
    );
}
