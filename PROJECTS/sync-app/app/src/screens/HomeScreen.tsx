import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import type { Friend } from '../types';

// Mock data for development
const MOCK_FRIENDS: Friend[] = [
  {
    id: '1',
    phone: '+1234567890',
    display_name: 'Alice',
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    friendship_id: 'f1',
    is_online: true,
  },
  {
    id: '2',
    phone: '+0987654321',
    display_name: 'Bob',
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    friendship_id: 'f2',
    is_online: false,
  },
  {
    id: '3',
    phone: '+1122334455',
    display_name: 'Charlie',
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    friendship_id: 'f3',
    is_online: true,
  },
];

export default function HomeScreen() {
  const [friends] = useState<Friend[]>(MOCK_FRIENDS);
  const [seeking, setSeeking] = useState<string | null>(null);

  const handleTap = (friendId: string) => {
    if (seeking === friendId) {
      // Cancel seek
      setSeeking(null);
    } else {
      // Start seeking
      setSeeking(friendId);
      // Auto-cancel after 1 minute
      setTimeout(() => {
        setSeeking(null);
      }, 60000);
    }
  };

  const handleLongPress = (friendId: string) => {
    // Quantum ping
    console.log('Quantum ping sent to:', friendId);
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const isSeeking = seeking === item.id;

    return (
      <TouchableOpacity
        style={[styles.friendCard, isSeeking && styles.friendCardSeeking]}
        onPress={() => handleTap(item.id)}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.friendInfo}>
          <View
            style={[
              styles.statusDot,
              item.is_online ? styles.statusOnline : styles.statusOffline,
            ]}
          />
          <View style={styles.friendText}>
            <Text style={styles.friendName}>{item.display_name}</Text>
            <Text style={styles.friendStatus}>
              {item.is_online ? 'online' : 'offline'}
            </Text>
          </View>
        </View>
        {isSeeking && (
          <View style={styles.seekingIndicator}>
            <Text style={styles.seekingText}>seeking...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>SYNC</Text>
        <Text style={styles.subtitle}>
          {friends.filter((f) => f.is_online).length} online
        </Text>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          tap → instant call (1min window)
        </Text>
        <Text style={styles.instructionText}>
          hold → quantum ping (24h window)
        </Text>
      </View>

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>mvp build • mock data</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 4,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#0f0f15',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  instructionText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  list: {
    paddingVertical: 10,
  },
  friendCard: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#0f0f15',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendCardSeeking: {
    backgroundColor: '#1a1a2e',
    borderLeftWidth: 2,
    borderLeftColor: '#ff6ec7',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  statusOnline: {
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  statusOffline: {
    backgroundColor: '#333',
  },
  friendText: {
    gap: 3,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 1,
  },
  friendStatus: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  seekingIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#ff6ec7',
    borderRadius: 2,
  },
  seekingText: {
    fontSize: 10,
    color: '#000',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#1a1a2e',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#1a1a2e',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
