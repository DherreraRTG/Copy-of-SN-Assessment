import React from 'react';
import { createRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MyAssessments from '../screens/MyAssessments';
import SkuSelection from '../screens/SkuSelection';
import AssessmentPlayer from '../screens/AssessmentPlayer';
import SubmissionSuccess from '../screens/SubmissionSuccess';
import ErrorScreen from '../screens/ErrorScreen';

const Stack = createNativeStackNavigator();

/**
 * navigationRef — exported so App.jsx can imperatively navigate
 * from deep link handlers before any screen is mounted.
 */
export const navigationRef = createRef();

/**
 * Deep linking config for React Navigation.
 * Maps rtgaudit://assessment?instance_sys_id=xxx
 * directly to AssessmentPlayer with instanceSysId param.
 */
const linking = {
  prefixes: ['rtgaudit://', 'http://localhost:8081', 'https://localhost:8081', 'https://sn-assessment-expo.vercel.app'],
  config: {
    screens: {
      // /assessment?instance_sys_id=...&task_sys_id=... → MyAssessments (auto-loads)
      MyAssessments: {
        path: 'assessment',
        parse: {
          instance_sys_id: (value) => value,
          task_sys_id: (value) => value,
          sn_instance: (value) => value,
        },
      },
      SkuSelection: 'sku-selection',
      AssessmentPlayer: 'player',
    },
  },
};

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        initialRouteName="MyAssessments"
        screenOptions={{
          headerStyle: { backgroundColor: '#1b1b38' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '600', fontSize: 15 },
          contentStyle: { backgroundColor: '#f2f4f7' },
        }}
      >
        <Stack.Screen
          name="MyAssessments"
          component={MyAssessments}
          options={{ title: 'My Assessments' }}
        />
        <Stack.Screen
          name="SkuSelection"
          component={SkuSelection}
          options={{ title: 'Select SKUs' }}
        />
        <Stack.Screen
          name="AssessmentPlayer"
          component={AssessmentPlayer}
          options={{ title: 'Assessment' }}
        />
        <Stack.Screen
          name="SubmissionSuccess"
          component={SubmissionSuccess}
          options={{ title: 'Submitted', headerBackVisible: false }}
        />
        <Stack.Screen
          name="Error"
          component={ErrorScreen}
          options={{ title: 'Error', headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}