// commands/remove-offense.js
export default async function (interaction, { userTimeouts }) {
    const target = interaction.options.getUser('target');
    if (userTimeouts[target.id]) {
        userTimeouts[target.id] = Math.max(0, userTimeouts[target.id] - 1);
    }
    interaction.reply({ content: `✅ ${target.tag}'s offense count reduced.`, ephemeral: true });
}