
import { COMPONENT_NAMES } from 'ozaria/site/components/teacher-dashboard/common/constants.js'

export default {
  namespaced: true,

  state: {
    teacherId: '',
    classroomId: '', // current classrom id for single class page and projects page
    selectedCourseIdForClassroom: {}, // selectedCourse for each classroomId across single class and student projects page
    loading: false
  },

  mutations: {
    setTeacherId (state, teacherId) {
      if (!state.teacherId) {
        state.teacherId = teacherId
      }
    },
    startLoading (state) {
      state.loading = true
    },
    stopLoading (state) {
      state.loading = false
    },
    resetLoadingState (state) {
      state.loading = false
    },
    setClassroomId (state, classroomId) {
      state.classroomId = classroomId
    },
    setSelectedCourseIdCurrentClassroom (state, { courseId }) {
      if (state.classroomId) {
        Vue.set(state.selectedCourseIdForClassroom, state.classroomId, courseId)
      }
    }
  },

  getters: {
    getLoadingState (state) {
      return state.loading
    },
    getActiveClassrooms (state, _getters, _rootState, rootGetters) {
      if (state.teacherId) {
        return rootGetters['classrooms/getActiveClassroomsByTeacher'](state.teacherId) || []
      } else {
        return []
      }
    },
    getArchivedClassrooms (state, _getters, _rootState, rootGetters) {
      if (state.teacherId) {
        return rootGetters['classrooms/getArchivedClassroomsByTeacher'](state.teacherId) || []
      } else {
        return []
      }
    },
    getCurrentClassroom (state, _getters, _rootState, rootGetters) {
      if (state.teacherId && state.classroomId) {
        const classrooms = rootGetters['classrooms/getActiveClassroomsByTeacher'](state.teacherId) || []
        return classrooms.find((c) => c._id === state.classroomId) || {}
      } else {
        return {}
      }
    },
    getCoursesCurrentClassroom (state, getters, _rootState, rootGetters) {
      if (state.classroomId) {
        const classroom = getters['getCurrentClassroom']
        const classroomCourseIds = (classroom.courses || []).map((c) => c._id) || []
        const courses = rootGetters['courses/sorted'] || []
        return courses.filter((c) => classroomCourseIds.includes(c._id))
      }
      return []
    },
    getSelectedCourseIdCurrentClassroom (state, getters) {
      if (state.classroomId && state.selectedCourseIdForClassroom[state.classroomId]) {
        return state.selectedCourseIdForClassroom[state.classroomId]
      } else { // TODO default should be last assigned course
        const classroomCourses = getters['getCoursesCurrentClassroom'] || []
        if (classroomCourses.length > 0) {
          return (classroomCourses[0] || {})._id
        }
      }
    },
    getMembersCurrentClassroom (state, getters, _rootState, rootGetters) {
      if (state.classroomId) {
        const classroom = getters['getCurrentClassroom']
        return rootGetters['users/getClassroomMembers'](classroom) || []
      }
      return []
    },
    getLevelSessionsMapCurrentClassroom (state, _getters, _rootState, rootGetters) {
      if (state.classroomId) {
        return rootGetters['levelSessions/getSessionsMapForClassroom'](state.classroomId) || {}
      }
      return {}
    },
    getGameContentCurrentClassroom (state, _getters, _rootState, rootGetters) {
      if (state.classroomId) {
        return rootGetters['gameContent/getContentForClassroom'](state.classroomId) || {}
      }
      return {}
    }
  },

  actions: {
    // componentName = name of the vue component -> used to fetch relevant data for the respective page
    // options = { data: {} }
    // options.data = {} -> contains specific properties to fetch (or `project`) for an object as a string, eg: {users: 'firstName,lastName,email', levelSessions: 'state.complete,level,creator,changed'}
    async fetchData ({ state, dispatch, commit }, { componentName, options = {} }) {
      if (!state.teacherId) {
        console.error('Error in fetching data: teacherId is not set')
        noty({ text: 'Error in fetching data', type: 'error', layout: 'center', timeout: 2000 })
        return
      }

      commit('startLoading')
      try {
        if (componentName === COMPONENT_NAMES.MY_CLASSES_ALL) {
          // My classes page
          await dispatch('fetchDataAllClasses', options)
        } else if (componentName === COMPONENT_NAMES.MY_CLASSES_SINGLE) {
          // Single class progress page
          await dispatch('fetchDataSingleClass', options)
        } else if (componentName === COMPONENT_NAMES.STUDENT_PROJECTS) {
          // Students progress page
          await dispatch('fetchDataStudentProjects', options)
        } else if (componentName === COMPONENT_NAMES.MY_LICENSES) {
          // Teacher licenses page
          await dispatch('fetchDataMyLicenses', options)
        } else if (componentName === COMPONENT_NAMES.RESOURCE_HUB) {
          // Resource Hub page
          await dispatch('fetchDataResourceHub', options)
        }
      } catch (err) {
        console.error('Error in fetching data:', err)
        noty({ text: 'Error in fetching data', type: 'error', layout: 'topCenter', timeout: 2000 })
      } finally {
        commit('stopLoading')
      }
    },

    // My classes page
    // options.data = { levelSessions: '' } -> properties needed for these objects, i.e. will be used as `project` in db queries
    async fetchDataAllClasses ({ state, dispatch, rootGetters }, options = {}) {
      const fetchPromises = []

      fetchPromises.push(dispatch('prepaids/fetchPrepaidsForTeacher', state.teacherId, { root: true }))
      fetchPromises.push(dispatch('courses/fetchReleased', undefined, { root: true }))
      fetchPromises.push(dispatch('courseInstances/fetchCourseInstancesForTeacher', state.teacherId, { root: true }))

      await dispatch('classrooms/fetchClassroomsForTeacher', state.teacherId, { root: true })
      const classrooms = rootGetters['classrooms/getClassroomsByTeacher'](state.teacherId)
      if (((classrooms || {}).active || []).length > 0) {
        classrooms.active.forEach((classroom) => {
          const levelSessionOptions = {
            project: (options.data || {}).levelSessions
          }
          fetchPromises.push(dispatch('levelSessions/fetchForClassroomMembers', { classroom, options: levelSessionOptions }, { root: true }))
        })
      }

      await Promise.all(fetchPromises)
    },

    // Single class progress page
    // options.data = { users: '', levelSessions: '' } -> properties needed for these objects, i.e. will be used as `project` in db queries
    async fetchDataSingleClass ({ state, dispatch, rootGetters }, options = {}) {
      const fetchPromises = []

      fetchPromises.push(dispatch('prepaids/fetchPrepaidsForTeacher', state.teacherId, { root: true }))
      fetchPromises.push(dispatch('courses/fetchReleased', undefined, { root: true }))
      fetchPromises.push(dispatch('courseInstances/fetchCourseInstancesForTeacher', state.teacherId, { root: true }))
      await dispatch('classrooms/fetchClassroomsForTeacher', state.teacherId, { root: true })

      if (!state.classroomId) {
        console.error('Error in fetching data: classroomId is not set')
        noty({ text: 'Error in fetching data', type: 'error', layout: 'center', timeout: 2000 })
        return
      }
      const gameContentOptions = {
        project: _.pick(options.data || {}, 'cinematics', 'interactives', 'cutscenes', 'levels')
      }
      fetchPromises.push(dispatch('gameContent/fetchGameContentForClassoom', { classroomId: state.classroomId, options: gameContentOptions }, { root: true }))

      const teacherClassrooms = rootGetters['classrooms/getClassroomsByTeacher'](state.teacherId)
      const classroom = ((teacherClassrooms || {}).active || []).find((cl) => cl._id === state.classroomId)
      if (classroom) {
        const userOptions = {
          project: (options.data || {}).users
        }
        fetchPromises.push(dispatch('users/fetchClassroomMembers', { classroom, options: userOptions }, { root: true }))
        const levelSessionOptions = {
          project: (options.data || {}).levelSessions
        }
        fetchPromises.push(dispatch('levelSessions/fetchForClassroomMembers', { classroom, options: levelSessionOptions }, { root: true }))
        fetchPromises.push(dispatch('interactives/fetchSessionsForClassroomMembers', classroom, { root: true }))
      }

      await Promise.all(fetchPromises)
    },

    // Students progress page
    // options.data = { users: '', levelSessions: '' } -> properties needed for these objects, i.e. will be used as `project` in db queries
    async fetchDataStudentProjects ({ state, dispatch, rootGetters }, options = {}) {
      const fetchPromises = []

      fetchPromises.push(dispatch('prepaids/fetchPrepaidsForTeacher', state.teacherId, { root: true }))
      fetchPromises.push(dispatch('courses/fetchReleased', undefined, { root: true }))
      await dispatch('classrooms/fetchClassroomsForTeacher', state.teacherId, { root: true })

      if (!state.classroomId) {
        console.error('Error in fetching data: classroomId is not set')
        noty({ text: 'Error in fetching data', type: 'error', layout: 'center', timeout: 2000 })
        return
      }

      const gameContentOptions = {
        project: _.pick(options.data || {}, 'cinematics', 'interactives', 'cutscenes', 'levels')
      }
      fetchPromises.push(dispatch('gameContent/fetchGameContentForClassoom', { classroomId: state.classroomId, options: gameContentOptions }, { root: true }))

      const teacherClassrooms = rootGetters['classrooms/getClassroomsByTeacher'](state.teacherId)
      const classroom = ((teacherClassrooms || {}).active || []).find((cl) => cl._id === state.classroomId)
      if (classroom) {
        const userOptions = {
          project: (options.data || {}).users
        }
        fetchPromises.push(dispatch('users/fetchClassroomMembers', { classroom, options: userOptions }, { root: true }))
        const levelSessionOptions = {
          project: (options.data || {}).levelSessions
        }
        fetchPromises.push(dispatch('levelSessions/fetchForClassroomMembers', { classroom, options: levelSessionOptions }, { root: true }))
      }

      await Promise.all(fetchPromises)
    },

    // Teacher licenses page
    async fetchDataMyLicenses ({ state, dispatch }, options = {}) {
      const fetchPromises = []

      fetchPromises.push(dispatch('classrooms/fetchClassroomsForTeacher', state.teacherId, { root: true }))
      fetchPromises.push(dispatch('prepaids/fetchPrepaidsForTeacher', state.teacherId, { root: true }))

      await Promise.all(fetchPromises)
    },

    // Resource Hub Page
    async fetchDataResourceHub ({ state, dispatch }, options = {}) {
      await dispatch('classrooms/fetchClassroomsForTeacher', state.teacherId, { root: true })
    }

    // TODO use for curriculum guides page
    // async fetchDataCurriculumGuide ({ state, dispatch }, campaignId) {
    // TODO send project options
    //   await dispatch('gameContent/fetchGameContentForCampaign', campaignId, { root: true })
    // }
  }
}
