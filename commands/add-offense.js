export default async (interaction, context) => {
    const { userTimeouts, formatTime } = context;

    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const corrector = interaction.options.getUser('corrector');
    const member = await interaction.guild.members.fetch(target.id);

    if (!userTimeouts[target.id]) userTimeouts[target.id] = 0;
    userTimeouts[target.id]++;

    const offenses = userTimeouts[target.id];

    const embed = {
        title: `📛 Offense manually added for ${target.tag}`,
        description:
            `**Reason:** ${reason}\n` +
            (corrector ? `**Corrected by:** ${corrector}\n` : '') +
            `**Offense Count Today:** ${offenses}`,
        color: 0xFFA500, // orange
        timestamp: new Date().toISOString()
    };

    const channel = interaction.guild.channels.cache.find(c => c.name === 'husher-announcements');
    if (channel) await channel.send({ embeds: [embed] });

    await interaction.reply({
        content: `✅ Offense recorded for ${target.tag}. Total: ${offenses}`,
        flags: 1 << 6
    });
};
