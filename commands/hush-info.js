// commands/hush-info.js
export default async function (interaction, { userTimeouts }) {
    const target = interaction.options.getUser('target');
    const offenses = userTimeouts[target.id] || 0;
    interaction.reply({ content: `📊 ${target.tag} has been hushed ${offenses} time(s) today.`, ephemeral: true });
}