import { world, system, MolangVariableMap, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";


const colorSchema = [
    [255, 100, 103],
    [255, 137, 4],
    [255, 185, 0],
    [253, 199, 0],
    [154, 230, 0],
    [5, 223, 114],
    [0, 212, 146],
    [0, 213, 190],
    [0, 211, 242],
    [0, 188, 255],
    [80, 162, 255],
    [124, 134, 255],
    [166, 132, 255],
    [194, 122, 255],
    [237, 106, 255],
    [251, 100, 182],
    [255, 99, 126]
]

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

    registry.registerCommand(
        {
            name: "footsteps:trail_time",
            description: "Set footstep trail lifetime (in seconds)",
            permissionLevel: CommandPermissionLevel.Any,
            mandatoryParameters: [
                {
                    name: "seconds",
                    type: CustomCommandParamType.Float
                }
            ]
        },
        (origin, seconds) => {
            const player = origin.entity || origin.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;

            if (seconds <= 0) {
                system.run(() => player.sendMessage("§cLifetime must be positive."));
                return;
            }

            system.run(() => {
                player.setDynamicProperty("footsteps:lifetime", seconds);
                player.sendMessage(`§aFootsteps lifetime set to ${seconds} seconds.`);
            });
        }
    );

    registry.registerCommand(
        {
            name: "footsteps:trail_color",
            description: `Set footstep trail color index (0-${colorSchema.length - 1})`,
            permissionLevel: CommandPermissionLevel.Any,
            mandatoryParameters: [
                {
                    name: "index",
                    type: CustomCommandParamType.Integer
                }
            ]
        },
        (origin, index) => {
            const player = origin.entity || origin.sourceEntity;
            if (!player || player.typeId !== "minecraft:player") return;

            if (index < 0 || index >= colorSchema.length) {
                system.run(() => player.sendMessage(`§cInvalid color index. Must be between 0 and ${colorSchema.length - 1}.`));
                return;
            }

            system.run(() => {
                player.setDynamicProperty("footsteps:color_index", index);
                player.sendMessage(`§aFootsteps color set to index ${index}.`);
            });
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
}, 4); // Run every 4 ticks (approx 5 times per second)

/**
 * Spawns a particle at the specified location
 */
function spawnFootstep(player, location) {
    const vars = new MolangVariableMap();

    // Determine color
    let color;
    const userColorIndex = player.getDynamicProperty("footsteps:color_index");

    if (userColorIndex !== undefined && userColorIndex >= 0 && userColorIndex < colorSchema.length) {
        // Use user selected color
        const [r, g, b] = colorSchema[userColorIndex];
        color = { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 };
    } else {
        // Fallback to name hash color
        color = stringToColor(player.name);
    }

    vars.setColorRGBA("variable.color", color);

    // Set lifetime
    let lifetime = player.getDynamicProperty("footsteps:lifetime");
    if (lifetime === undefined || lifetime <= 0) lifetime = 10.0;
    vars.setFloat("variable.lifetime", lifetime);

    // Set rotation based on player yaw
    const yaw = player.getRotation().y;
    vars.setFloat("variable.rot", 180 - yaw);

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

    const idx = Math.abs(hash) % colorSchema.length;
    const [r, g, b] = colorSchema[idx];
    return { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 };
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
