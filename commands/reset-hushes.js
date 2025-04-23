// commands/reset-hushes.js
export default async function (interaction, { userTimeouts }) {
    for (const key in userTimeouts) delete userTimeouts[key];
    interaction.reply({ content: '✅ All offenses reset for today.', ephemeral: true });
}